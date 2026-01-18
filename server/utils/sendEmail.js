// sendEmail.js
import sgMail from '@sendgrid/mail';

// Set SendGrid API key from environment
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const sendEmail = async function (to, subject, message) {
  try {
    const info = await sgMail.send({
      to,
      from: {
        email: process.env.EMAIL_FROM_EMAIL,   // verified email
        name: process.env.EMAIL_FROM_NAME || 'Security Alert', // display name
      },
      subject,
      html: message,
    });

    // info is an array for API requests, log for consistency
    console.log('Email sent:', info[0].statusCode);
    return true;
  } catch (error) {
    console.error('Email failed:', error.response?.body || error);
    return false;
  }
};

export default sendEmail;
