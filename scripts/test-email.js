const nodemailer = require('nodemailer');

async function testSend() {
  const user = 'contatoesp.tec@gmail.com';
  const pass = 'nhhkbeocckssjzpp';

  console.log(`Conectando ao SMTP do Gmail com ${user}...`);

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user,
      pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"NORA Pro / ESP-TEC" <${user}>`,
      to: 'elias.speixoto@gmail.com',
      subject: 'Teste de Integração de E-mail - NORA Pro 🚀',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 24px; text-align: center;">
            <h2 style="color: #38bdf8; margin: 0;">ESP-TEC Instalações</h2>
            <p style="color: #94a3b8; margin: 4px 0 0 0;">Assistente Virtual NORA Pro</p>
          </div>
          <div style="padding: 24px; color: #334155; line-height: 1.6;">
            <h3>Olá, Elias!</h3>
            <p>Este é um e-mail de teste confirmando que a integração da <strong>NORA Pro</strong> com o envio de e-mails via Gmail SMTP está <strong>100% ativa e operacional</strong>!</p>
            <p>A partir de agora, a NORA pode disparar orçamentos em PDF, notificações e relatórios técnicos por e-mail com total autonomia.</p>
          </div>
        </div>
      `,
    });

    console.log('✅ SUCESSO! E-mail enviado com sucesso.');
    console.log('Message ID:', info.messageId);
  } catch (error) {
    console.error('❌ ERRO ao enviar e-mail:', error);
  }
}

testSend();
