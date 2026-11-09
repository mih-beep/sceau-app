import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { submitToOts } from '@/lib/ots';
import { buildS3Key } from '@/lib/safe-key';
import { apiError } from '@/lib/api-error';
import { requireS3 } from '@/lib/env';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  let uploadedKey: string | null = null;
  try {
    const data = await req.formData();
    const hash = data.get('hash') as string;
    const title = ((data.get('title') as string) || '').trim();
    const description = ((data.get('description') as string) || '').trim();
    const isFlash = data.get('isFlash') === 'true';
    const isMystery = data.get('isMystery') === 'true';
    const isEphemeral = data.get('isEphemeral') === 'true';
    const unlockLikes = parseInt((data.get('unlockLikes') as string) || '0', 10);
    const pubkey = data.get('pubkey') as string;
    const projectIdInput = (data.get('project_id') as string) || null;
    const challengeId = (data.get('challenge_id') as string) || null;
    const visibilityInput = (data.get('visibility') as string) || 'public';
    const isHostedInput = data.get('isHosted') !== 'false';
    const revealAt = (data.get('reveal_at') as string) || null;
    const file = data.get('file') as File | null;

    if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    if (!['public', 'private', 'friends'].includes(visibilityInput)) {
      return NextResponse.json({ error: 'Visibilité invalide' }, { status: 400 });
    }

    const user = await pool.query(
      "SELECT id FROM users WHERE encode(pubkey, 'base64') = $1",
      [pubkey]
    );
    if (user.rows.length === 0) return NextResponse.json({ error: 'Utilisateur inconnu' }, { status: 401 });
    const authorId = user.rows[0].id as string;

    let otsProof: string | null = null;
    try {
      const ots = await submitToOts(new Uint8Array(Buffer.from(hash, 'base64')));
      if (ots.ok && ots.proof) otsProof = ots.proof.toString('base64');
      else console.warn('[OTS] échec :', ots.error);
    } catch (e) { console.warn('[OTS] exception :', e); }

    let filePath: string | null = null;
    let fileSize = 0;
    if (isHostedInput && !isFlash && file && file.size > 0) {
      const quota = await pool.query(
        "SELECT COALESCE(SUM(file_size), 0) as used FROM seals WHERE author_id = $1 AND is_hosted = true",
        [authorId]
      );
      if (parseInt(quota.rows[0].used, 10) + file.size > 100 * 1024 * 1024) {
        return NextResponse.json({ error: 'Quota de 50 Mo dépassé.' }, { status: 403 });
      }
      fileSize = file.size;
      const buffer = Buffer.from(await file.arrayBuffer());
      uploadedKey = buildS3Key({ authorId, hashBase64: hash, originalName: file.name });
      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: uploadedKey,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
        ContentLength: buffer.length,
      }));
      const { endpoint, bucket } = requireS3();
      filePath = `${endpoint}/${bucket}/${uploadedKey}`;
    }

    const client = await pool.connect();
    let sealId: string;
    let projectId: string | null = null;
    let versionNumber = 1;

    try {
      await client.query('BEGIN');

      if (projectIdInput && !isFlash) {
        const ref = await client.query(
          "SELECT id, project_id, author_id FROM seals WHERE id = $1",
          [projectIdInput]
        );
        if (ref.rows.length > 0 && ref.rows[0].author_id === authorId) {
          if (ref.rows[0].project_id) {
            projectId = ref.rows[0].project_id;
          } else {
            const np = await client.query(
              "INSERT INTO projects (author_id, name) VALUES ($1, $2) RETURNING id",
              [authorId, title]
            );
            projectId = np.rows[0].id;
            await client.query(
              "UPDATE seals SET project_id = $1, version_number = 1 WHERE id = $2",
              [projectId, projectIdInput]
            );
          }
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [projectId]);
          const maxV = await client.query(
            "SELECT COALESCE(MAX(version_number), 0) as m FROM seals WHERE project_id = $1",
            [projectId]
          );
          versionNumber = (maxV.rows[0].m || 0) + 1;
        }
      }

      const result = await client.query(
        `INSERT INTO seals (
          hash, timestamp, author_id, title, description, is_public, visibility,
          is_hosted, file_path, file_size, is_flash, is_mystery, unlock_likes, is_ephemeral,
          ots_proof, ots_submitted_at, project_id, version_number, challenge_id, reveal_at
        ) VALUES (
          decode($1, 'base64'), NOW(), $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19
        ) RETURNING id`,
        [
          hash, authorId, title, description,
          visibilityInput === 'public', visibilityInput,
          !isFlash && filePath ? true : false, filePath, fileSize,
          isFlash, isMystery, unlockLikes, isEphemeral,
          otsProof, otsProof ? new Date() : null,
          projectId, versionNumber, challengeId, revealAt || null,
        ]
      );
      sealId = result.rows[0].id;

      if (challengeId) {
        const cc = await client.query(
          "SELECT id, deadline FROM challenges WHERE id = $1",
          [challengeId]
        );
        if (cc.rows.length > 0 && new Date(cc.rows[0].deadline) > new Date()) {
          await client.query(
            "INSERT INTO challenge_entries (challenge_id, user_id, seal_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            [challengeId, authorId, sealId]
          );
        }
      }

      await client.query('COMMIT');
    } catch (e: any) {
      await client.query('ROLLBACK');
      if (uploadedKey) {
        r2Client.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: uploadedKey }))
          .catch(() => { /* fichier orphelin déjà supprimé */ });
      }
      if (e?.code === '23505' && /unique_seal/.test(String(e?.constraint || ''))) {
        return NextResponse.json({ error: 'Ce fichier a déjà été scellé par vous.' }, { status: 409 });
      }
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({
      seal_id: sealId,
      ots_secured: otsProof !== null,
      project_id: projectId,
      version_number: versionNumber,
      challenge_id: challengeId,
    });
  } catch (e) {
    return apiError(e, 'Erreur lors du scellement');
  }
}
