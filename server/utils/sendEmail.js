import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async (to, subject, html) => {
  try {
    await sgMail.send({
      to,
      from: process.env.EMAIL_FROM, // loaded from env, safe in repo
      subject,
      html,
    });
    console.log('Email sent to', to);
    return true;
  } catch (err) {
    console.error('SendGrid error:', err.response?.body || err);
    return false;
  }
};

export default sendEmail;
