const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Email templates
 */
const emailTemplates = {
  // Welcome email
  welcome: (name, activationLink) => ({
    subject: 'Welcome to Exquisite Wears!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Exquisite Wears, ${name}!</h2>
        <p>We're thrilled to have you join our community.</p>
        <p>To get started, please confirm your email address:</p>
        <a href="${activationLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0;">
          Confirm Email
        </a>
        <p>If you didn't create an account, please ignore this email.</p>
        <hr />
        <p style="color: #6B7280; font-size: 12px;">© 2024 Exquisite Wears. All rights reserved.</p>
      </div>
    `,
  }),

  // Order confirmation
  orderConfirmation: (orderNumber, items, total, estimatedDelivery) => ({
    subject: `Order Confirmation #${orderNumber}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Order Confirmed!</h2>
        <p>Thank you for your purchase. Your order has been received and is being processed.</p>
        
        <h3>Order Details</h3>
        <p><strong>Order Number:</strong> ${orderNumber}</p>
        <p><strong>Estimated Delivery:</strong> ${estimatedDelivery}</p>
        
        <h3>Items</h3>
        <ul>
          ${items.map((item) => `<li>${item.name} x${item.quantity} - ₦${item.price.toLocaleString()}</li>`).join('')}
        </ul>
        
        <h3>Total: ₦${total.toLocaleString()}</h3>
        
        <p>You'll receive a tracking number once your order ships.</p>
        <a href="https://exquisitewears.com/orders" style="background-color: #3B82F6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0;">
          Track Order
        </a>
        
        <hr />
        <p style="color: #6B7280; font-size: 12px;">© 2024 Exquisite Wears. All rights reserved.</p>
      </div>
    `,
  }),

  // Order shipped
  orderShipped: (orderNumber, trackingNumber, carrier) => ({
    subject: `Your Order #${orderNumber} Has Shipped!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your Order is On the Way!</h2>
        <p>Good news! Your order has been shipped.</p>
        
        <h3>Shipping Details</h3>
        <p><strong>Order Number:</strong> ${orderNumber}</p>
        <p><strong>Tracking Number:</strong> ${trackingNumber}</p>
        <p><strong>Carrier:</strong> ${carrier}</p>
        
        <p>You can track your package using the tracking number above.</p>
        <a href="https://exquisitewears.com/orders/${orderNumber}" style="background-color: #3B82F6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0;">
          View Order Details
        </a>
        
        <hr />
        <p style="color: #6B7280; font-size: 12px;">© 2024 Exquisite Wears. All rights reserved.</p>
      </div>
    `,
  }),

  // Order delivered
  orderDelivered: (orderNumber) => ({
    subject: `Your Order #${orderNumber} Has Been Delivered!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Delivery Confirmed!</h2>
        <p>Your order has been successfully delivered.</p>
        
        <h3>What's Next?</h3>
        <ul>
          <li>Inspect your items for any damage</li>
          <li>Leave a review and help other customers</li>
          <li>Return or exchange items within 30 days</li>
        </ul>
        
        <a href="https://exquisitewears.com/orders/${orderNumber}" style="background-color: #3B82F6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0;">
          Leave a Review
        </a>
        
        <p>We'd love to hear about your experience. Your feedback helps us improve!</p>
        
        <hr />
        <p style="color: #6B7280; font-size: 12px;">© 2024 Exquisite Wears. All rights reserved.</p>
      </div>
    `,
  }),

  // Price drop alert
  priceDropAlert: (productName, originalPrice, newPrice, productLink) => ({
    subject: `${productName} Price Dropped!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Great News! A Price Drop on Your Wishlist Item</h2>
        <p><strong>${productName}</strong> is now on sale!</p>
        
        <h3>Price Details</h3>
        <p>
          <span style="text-decoration: line-through;">₦${originalPrice.toLocaleString()}</span>
          <span style="color: #DC2626; font-size: 24px; margin-left: 10px;">₦${newPrice.toLocaleString()}</span>
        </p>
        <p style="color: #16A34A; font-weight: bold;">You save: ₦${(originalPrice - newPrice).toLocaleString()}</p>
        
        <p>Don't miss out! This deal won't last long.</p>
        <a href="${productLink}" style="background-color: #DC2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0;">
          Shop Now
        </a>
        
        <hr />
        <p style="color: #6B7280; font-size: 12px;">© 2024 Exquisite Wears. All rights reserved.</p>
      </div>
    `,
  }),

  // Password reset
  passwordReset: (resetLink) => ({
    subject: 'Reset Your Exquisite Wears Password',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>We received a request to reset your password. Click the link below to create a new password:</p>
        
        <a href="${resetLink}" style="background-color: #3B82F6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0;">
          Reset Password
        </a>
        
        <p style="color: #6B7280;">This link will expire in 24 hours.</p>
        <p>If you didn't request a password reset, please ignore this email.</p>
        
        <hr />
        <p style="color: #6B7280; font-size: 12px;">© 2024 Exquisite Wears. All rights reserved.</p>
      </div>
    `,
  }),

  // Review request
  reviewRequest: (productName, productImage, productLink) => ({
    subject: `How was your ${productName}?`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>We'd Love Your Feedback!</h2>
        <p>How's your <strong>${productName}</strong> treating you?</p>
        
        <img src="${productImage}" alt="${productName}" style="max-width: 300px; height: auto; margin: 20px 0; border-radius: 8px;" />
        
        <p>Share your experience with other customers. Your honest review helps us serve you better!</p>
        
        <a href="${productLink}#reviews" style="background-color: #3B82F6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0;">
          Write a Review
        </a>
        
        <hr />
        <p style="color: #6B7280; font-size: 12px;">© 2024 Exquisite Wears. All rights reserved.</p>
      </div>
    `,
  }),

  // Restock notification
  restockNotification: (productName, productLink) => ({
    subject: `${productName} is Back in Stock!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Good News! Back in Stock</h2>
        <p><strong>${productName}</strong> is now available again!</p>
        
        <p>You added this to your wishlist. Don't miss out—grab it before it sells out!</p>
        
        <a href="${productLink}" style="background-color: #16A34A; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block; margin: 20px 0;">
          View Product
        </a>
        
        <hr />
        <p style="color: #6B7280; font-size: 12px;">© 2024 Exquisite Wears. All rights reserved.</p>
      </div>
    `,
  }),

  // Newsletter
  newsletter: (content) => ({
    subject: 'Exquisite Wears - Latest Updates & Exclusive Offers',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>What's New at Exquisite Wears?</h2>
        ${content}
        
        <p>
          <a href="https://exquisitewears.com" style="color: #3B82F6; text-decoration: none;">Visit Our Store</a> |
          <a href="https://exquisitewears.com/unsubscribe" style="color: #6B7280; text-decoration: none; margin-left: 20px;">Unsubscribe</a>
        </p>
        
        <hr />
        <p style="color: #6B7280; font-size: 12px;">© 2024 Exquisite Wears. All rights reserved.</p>
      </div>
    `,
  }),
};

/**
 * Send email
 */
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: process.env.SMTP_FROM || 'noreply@exquisitewears.com',
      to,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (error) {
    console.error('Email error:', error);
    throw error;
  }
};

/**
 * Welcome email
 */
const sendWelcomeEmail = async (userEmail, userName, activationLink) => {
  const template = emailTemplates.welcome(userName, activationLink);
  return sendEmail(userEmail, template.subject, template.html);
};

/**
 * Order confirmation email
 */
const sendOrderConfirmationEmail = async (userEmail, orderData) => {
  const template = emailTemplates.orderConfirmation(
    orderData.orderNumber,
    orderData.items,
    orderData.total,
    orderData.estimatedDelivery
  );
  return sendEmail(userEmail, template.subject, template.html);
};

/**
 * Send order shipped email
 */
const sendOrderShippedEmail = async (userEmail, orderNumber, trackingNumber, carrier) => {
  const template = emailTemplates.orderShipped(orderNumber, trackingNumber, carrier);
  return sendEmail(userEmail, template.subject, template.html);
};

/**
 * Send order delivered email
 */
const sendOrderDeliveredEmail = async (userEmail, orderNumber) => {
  const template = emailTemplates.orderDelivered(orderNumber);
  return sendEmail(userEmail, template.subject, template.html);
};

/**
 * Price drop alert email
 */
const sendPriceDropAlert = async (userEmail, productName, originalPrice, newPrice, productLink) => {
  const template = emailTemplates.priceDropAlert(productName, originalPrice, newPrice, productLink);
  return sendEmail(userEmail, template.subject, template.html);
};

/**
 * Password reset email
 */
const sendPasswordResetEmail = async (userEmail, resetLink) => {
  const template = emailTemplates.passwordReset(resetLink);
  return sendEmail(userEmail, template.subject, template.html);
};

/**
 * Review request email
 */
const sendReviewRequestEmail = async (userEmail, productName, productImage, productLink) => {
  const template = emailTemplates.reviewRequest(productName, productImage, productLink);
  return sendEmail(userEmail, template.subject, template.html);
};

/**
 * Restock notification email
 */
const sendRestockNotificationEmail = async (userEmail, productName, productLink) => {
  const template = emailTemplates.restockNotification(productName, productLink);
  return sendEmail(userEmail, template.subject, template.html);
};

/**
 * Newsletter email
 */
const sendNewsletterEmail = async (userEmail, content) => {
  const template = emailTemplates.newsletter(content);
  return sendEmail(userEmail, template.subject, template.html);
};

/**
 * Send bulk emails (for newsletters, alerts, etc.)
 */
const sendBulkEmails = async (recipients, subject, html) => {
  try {
    const results = [];

    for (const email of recipients) {
      try {
        const info = await sendEmail(email, subject, html);
        results.push({ email, status: 'sent', messageId: info.messageId });
      } catch (error) {
        results.push({ email, status: 'failed', error: error.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Bulk email error:', error);
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
  sendOrderShippedEmail,
  sendOrderDeliveredEmail,
  sendPriceDropAlert,
  sendPasswordResetEmail,
  sendReviewRequestEmail,
  sendRestockNotificationEmail,
  sendNewsletterEmail,
  sendBulkEmails,
};
