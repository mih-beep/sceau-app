import { NextResponse } from 'next/server';
import { pool } from '@/db/pool';
import crypto from 'crypto';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 });

  const user = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
  if (user.rows.length === 0) return NextResponse.json({ error: 'Email introuvable' }, { status: 404 });

  const token = crypto.randomBytes(32).toString('hex');
  const expiry = new Date(Date.now() + 3600000); 

  await pool.query("UPDATE users SET reset_token = $1, reset_expiry = $2 WHERE email = $3", [token, expiry, email]);

  // --- ENVOI DU VRAI EMAIL ---
  try {
    // On crée un compte de test Ethereal à la volée
    const testAccount = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });

    const resetLink = `http://localhost:3000/reset-password?token=${token}`;
    const info = await transporter.sendMail({
      from: '"SCEAU" <no-reply@sceau.app>',
      to: email,
      subject: "Réinitialisation de votre mot de passe",
      html: `<p>Bonjour,</p><p>Voici votre lien : <a href="${resetLink}">Réinitialiser mon mot de passe</a></p>`,
    });

    // On renvoie le lien de prévisualisation Ethereal pour que tu puisses voir l'email !
    const previewUrl = nodemailer.getTestMessageUrl(info);
    return NextResponse.json({ success: true, preview: previewUrl });
  } catch (error) {
    return NextResponse.json({ error: "Erreur d'envoi d'email" }, { status: 500 });
  }
}
