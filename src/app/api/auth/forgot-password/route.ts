import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import crypto from 'crypto';
import { Resend } from 'resend';

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 });

  const user = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Email introuvable' }, { status: 404 });

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 3600000); 

  await pool.query("UPDATE users SET reset_token = $1, reset_expiry = $2 WHERE email = $3", [token, expiry, email]);

  const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      // Si pas de clé, on simule l'envoi pour le développement
      console.log("⚠️ Pas de clé Resend. Lien de test :", resetLink);
      return NextResponse.json({ success: true, message: "Lien généré (voir console)" });
    }

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: 'SCEAU <onboarding@resend.dev>',
      to: email,
      subject: "Réinitialisation de votre mot de passe",
      html: `<p>Bonjour,</p><p>Voici votre lien : <a href="${resetLink}">Réinitialiser mon mot de passe</a></p>`,
    });
    return NextResponse.json({ success: true, message: "Email envoyé !" });
  } catch (error) {
    return NextResponse.json({ error: "Erreur d'envoi d'email" }, { status: 500 });
  }
}
