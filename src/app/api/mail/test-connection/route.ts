import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
    const { email, appPassword, to } = await req.json();

    if (!email || !appPassword) {
      return NextResponse.json(
        { success: false, error: 'E-mail corporativo e Senha de App são obrigatórios.' },
        { status: 400 }
      );
    }

    const cleanPass = appPassword.replace(/\s+/g, '');
    const recipient = to || email;

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: email,
        pass: cleanPass,
      },
    });

    const info = await transporter.sendMail({
      from: `"NORA Pro / Validação" <${email}>`,
      to: recipient,
      subject: '✅ Conexão de E-mail Validada - NORA Pro',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
          <div style="background-color: #0f172a; padding: 24px; text-align: center;">
            <h2 style="color: #38bdf8; margin: 0;">NORA Pro</h2>
            <p style="color: #94a3b8; margin: 4px 0 0 0;">Validação de Conexão de E-mail Corporativo</p>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <h3 style="color: #16a34a; margin-top: 0;">🎉 Conexão Estabelecida com Sucesso!</h3>
            <p>Este e-mail confirma que a conta <strong>${email}</strong> foi configurada corretamente no sistema.</p>
            <p>A partir de agora, a assistente NORA e o sistema podem disparar orçamentos, propostas em PDF e notificações de O.S. diretamente em nome da sua empresa.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      messageId: info.messageId,
      message: `E-mail de teste enviado com sucesso para ${recipient}!`,
    });
  } catch (error: any) {
    console.error('Erro no teste de email:', error);
    let userMsg = error.message;
    if (error.responseCode === 535 || error.message.includes('BadCredentials') || error.message.includes('Invalid login')) {
      userMsg = 'Credenciais rejeitadas pelo Google. Verifique se o e-mail está correto e se a Senha de App de 16 letras foi gerada no Google da conta correta.';
    }
    return NextResponse.json({ success: false, error: userMsg }, { status: 400 });
  }
}
