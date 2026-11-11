import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import { sha256 } from '@noble/hashes/sha256';
import { Resend } from 'resend';
import { summarizeChange } from '@/lib/oracle-summary';

export const runtime = 'nodejs';
export const maxDuration = 60;

function cleanHtmlToText(html: string): string {
  return html
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
    .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '')
    .replace(/<[^>]*>/g, '\n')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}

function hashContent(content: string): string {
  return Buffer.from(sha256(new TextEncoder().encode(content))).toString('hex');
}

function generateDiff(oldText: string, newText: string) {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff = [];
  const maxLines = Math.max(oldLines.length, newLines.length);
  let changesCount = 0;

  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] || '';
    const newLine = newLines[i] || '';
    if (oldLine !== newLine) {
      diff.push({ type: 'removed', text: oldLine.trim() });
      diff.push({ type: 'added', text: newLine.trim() });
      changesCount++;
    } else if (oldLine.trim() !== '') {
      diff.push({ type: 'unchanged', text: oldLine.trim() });
    }
  }
  return { changesCount, details: diff.slice(0, 100) };
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    const archives = await pool.query(`
      SELECT a.id, a.url, a.last_hash, a.last_content, u.email 
      FROM web_archives a 
      JOIN users u ON a.user_id = u.id
    `);
    
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    let scanned = 0;
    let modifiedCount = 0;

    for (const archive of archives.rows) {
      try {
        const res = await fetch(archive.url, { 
          headers: { 'User-Agent': 'SCEAU-Archive-Bot/1.0' },
          signal: AbortSignal.timeout(10000)
        });
        
        if (!res.ok) throw new Error('Site inaccessible');
        
        const html = await res.text();
        if (html.length > 5 * 1024 * 1024) throw new Error('Contenu trop lourd');
        
        const newText = cleanHtmlToText(html);
        const newHash = hashContent(newText);

        if (archive.last_hash !== newHash) {
          const diffResult = generateDiff(archive.last_content || '', newText);
          
          // 🧠 Résumé IA du changement
          const aiSummary = await summarizeChange(archive.last_content || '', newText, archive.url);
          
          await pool.query(
            "UPDATE web_archives SET last_status = 'modified', last_checked_at = NOW(), diff_data = $1, last_hash = $2, last_content = $3, ai_summary = $5 WHERE id = $4",
            [JSON.stringify(diffResult), newHash, newText, archive.id, aiSummary]
          );

          if (resend && archive.email) {
            await resend.emails.send({
              from: 'SCEAU Archive <alerte@sceau-app.vercel.app>',
              to: archive.email,
              subject: `🚨 Modification détectée sur ${archive.url}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h2 style="color: #E76F51;">SCEAU Archive</h2>
                  <p>Une modification a été détectée sur la page que vous surveillez :</p>
                  <p><a href="${archive.url}" style="background: #eee; padding: 10px; display: block; border-radius: 8px; color: #333; text-decoration: none;">${archive.url}</a></p>
                  <p><strong>${diffResult.changesCount} changements</strong> ont été trouvés.</p>
                  <a href="https://sceau-app.vercel.app/archive" style="display: inline-block; background: #1A1513; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px;">Voir le Diff complet</a>
                </div>
              `
            });
          }
          modifiedCount++;
        } else {
          await pool.query(
            "UPDATE web_archives SET last_status = 'intact', last_checked_at = NOW() WHERE id = $1",
            [archive.id]
          );
        }
        scanned++;
        // Pause 500ms entre chaque résumé pour respecter le rate limit de Groq
        await new Promise(r => setTimeout(r, 500));
      } catch (e) {
        // En cas d'erreur, on marque en erreur
        await pool.query(
          "UPDATE web_archives SET last_status = 'error', last_checked_at = NOW() WHERE id = $1",
          [archive.id]
        );
      }
    }

    return NextResponse.json({ success: true, scanned, modifiedCount });
  } catch (e) {
    return NextResponse.json({ error: 'Cron Error' }, { status: 500 });
  }
}
