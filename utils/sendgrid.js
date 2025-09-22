// SendGrid utility for sending emails
// Replaces replitmail.js for external deployment compatibility

const sgMail = require('@sendgrid/mail');

// Set SendGrid API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY not found. Email functionality may not work.');
}

async function sendEmail(message) {
  try {
    // Validate required fields
    if (!message.to) {
      throw new Error('Recipient email is required');
    }
    
    if (!message.subject) {
      throw new Error('Email subject is required');
    }

    // Configure email message for SendGrid
    const msg = {
      to: message.to,
      from: 'Info@smfurnishings.com', // Your verified sender
      subject: message.subject,
      text: message.text,
      html: message.html
    };

    // Add CC if provided
    if (message.cc) {
      msg.cc = message.cc;
    }

    // Send email via SendGrid
    const result = await sgMail.send(msg);
    console.log('✅ Email sent successfully via SendGrid');
    
    return {
      success: true,
      messageId: result[0].headers['x-message-id']
    };
    
  } catch (error) {
    console.error('❌ SendGrid email error:', error.message);
    
    // Provide more specific error messages
    if (error.code === 401) {
      throw new Error('SendGrid API key is invalid');
    } else if (error.code === 403) {
      throw new Error('SendGrid API key does not have permission to send emails');
    } else if (error.response?.body?.errors) {
      const errorMessage = error.response.body.errors.map(e => e.message).join(', ');
      throw new Error(`SendGrid error: ${errorMessage}`);
    } else {
      throw new Error(`Email sending failed: ${error.message}`);
    }
  }
}

module.exports = { sendEmail };