import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { r2Client } from '@/lib/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { anchorToBitcoin } from '../../../../../sceau-protocol/src/index';

export async function POST(req: Request) {
  try {
    const data = await req.formData();
    const hash = data.get('hash') as string;
    const title = data.get('title') as string;
    const description = (data.get('description') as string) || '';
    const isFlash = data.get('isFlash') === 'true';
    const isMystery = data.get('isMystery') === 'true';
    const isEphemeral = data.get('isEphemeral') === 'true';
    const unlockLikes = parseInt((data.get('unlockLikes') as string) || '0');
    const pubkey = data.get('pubkey') as string;
    const projectIdInput = (data.get('project_id') as string) || null;
    const challengeId = (data.get('challenge_id') as string) || null;
    const visibilityInput = (data.get('visibility') as string) || 'public';
    const file = data.get('file') as File | null;

    if (!['public', 'private', 'friends'].includes(visibilityInput)) {
      return NextResponse.json({ error: 'Visibility invalide' }, { status: 400 });
    }

    const user = await pool.query(
      "SELECT id FROM users WHERE encode(pubkey, 'base64') = $1",
      [pubkey]
    );
    if (user.rows.length === 0) {
      return NextResponse.json({ error: 'Utilisateur inconnu' }, { status: 401 });
    }
    const authorId = user.rows[0].id;

    // === Résolution projet (Dossier Miroir) ===
    let projectId: string | null = null;
    let versionNumber = 1;

    if (projectIdInput && !isFlash) {
      const ref = await pool.query(
        "SELECT id, project_id, author_id FROM seals WHERE id = $1",
        [projectIdInput]
      );
      if (ref.rows.length > 0 && ref.rows[0].author_id === authorId) {
        if (ref.rows[0].project_id) {
          projectId = ref.rows[0].project_id;
        } else {
          const newProject = await pool.query(
            "INSERT INTO projects (author_id, name) VALUES ($1, $2) RETURNING id",
            [authorId, title]
          );
          projectId = newProject.rows[0].id;
          await pool.query(
            "UPDATE seals SET project_id = $1, version_number = 1 WHERE id = $2",
            [projectId, projectIdInput]
          );
        }

        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [projectId]);
          const maxV = await client.query(
            "SELECT COALESCE(MAX(version_number), 0) as m FROM seals WHERE project_id = $1",
            [projectId]
          );
          versionNumber = (maxV.rows[0].m || 0) + 1;
          await client.query('COMMIT');
        } catch (e) {
          await client.query('ROLLBACK');
          throw e;
        } finally {
          client.release();
        }
      }
    }

    // === Ancrage OTS ===
    let otsProof: string | null = null;
    try {
      const hashBytes = new Uint8Array(Buffer.from(hash, 'base64'));
      const ots = await submitToOts(hashBytes);
      if (ots.ok && ots.proof) {
        otsProof = ots.proof.toString('base64');
        console.log(`[OTS] ancré via ${ots.calendars.length} calendar(s)`);
      } else {
        console.warn('[OTS] échec :', ots.error);
      }
    } catch (e) {
      console.warn('[OTS] exception :', e);
    }

    // === Upload fichier ===
    let filePath: string | null = null;
    let fileSize = 0;

    if (!isFlash && file && file.size > 0) {
      const quota = await pool.query(
        "SELECT COALESCE(SUM(file_size), 0) as used FROM seals WHERE author_id = $1 AND is_hosted = true",
        [authorId]
      );
      if (parseInt(quota.rows[0].used) + file.size > 50 * 1024 * 1024) {
        return NextResponse.json({ error: 'Quota de 50 Mo dépassé.' }, { status: 403 });
      }

      fileSize = file.size;
      const buffer = Buffer.from(await file.arrayBuffer());
      const filename = `${hash.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}-${file.name}`;

      await r2Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: filename,
        Body: buffer,
        ContentType: file.type || 'application/octet-stream',
      }));

      filePath = `${process.env.AWS_ENDPOINT_URL_S3}/${process.env.S3_BUCKET}/${filename}`;
    }

    // === Insertion ===
    const result = await pool.query(
      `INSERT INTO seals (
        hash, timestamp, author_id, title, description, is_public, visibility,
        is_hosted, file_path, file_size, is_flash, is_mystery, unlock_likes, is_ephemeral,
        ots_proof, ots_submitted_at, project_id, version_number, challenge_id
      ) VALUES (
        decode($1, 'base64'), NOW(), $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18
      ) RETURNING id`,
      [
        hash, authorId, title, description,
        visibilityInput === 'public', visibilityInput,
        !isFlash && filePath ? true : false, filePath, fileSize,
        isFlash, isMystery, unlockLikes, isEphemeral,
        otsProof, otsProof ? new Date() : null,
        projectId, versionNumber, challengeId,
      ]
    );
    const sealId = result.rows[0].id;

    // === Si défi, créer l'entrée challenge_entries ===
    if (challengeId) {
      try {
        const checkChallenge = await pool.query(
          "SELECT id, deadline FROM challenges WHERE id = $1",
          [challengeId]
        );
        if (checkChallenge.rows.length > 0 && new Date(checkChallenge.rows[0].deadline) > new Date()) {
          await pool.query(
            "INSERT INTO challenge_entries (challenge_id, user_id, seal_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
            [challengeId, authorId, sealId]
          );
        }
      } catch (e) {
        console.warn('[challenge_entry]', e);
      }
    }

    return NextResponse.json({
      seal_id: sealId,
      ots_secured: otsProof !== null,
      project_id: projectId,
      version_number: versionNumber,
      challenge_id: challengeId,
    });
  } catch (error: any) {
    console.error('[seal]', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}
