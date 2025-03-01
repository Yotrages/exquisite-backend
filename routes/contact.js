const express = require('express');
const nodemailer = require('nodemailer')
const router = express.Router()

router.post("/", async (req, res) => {
    const { name, email, subject, message } = req.body
    if(!name || !email || !subject || !message) {
        return res.status(400).json({
            success: false,
            message: "All fields are required"
        })
    }
        let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            service: 'gmail',
            auth: {
                user: process.env.EMAIL, 
                pass: process.env.EMAIL_PASS
            }
        });
    
        const mailOptions = {
            from: email,
            to: process.env.EMAIL,
            subject: subject,
            html: `
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f4;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                }
                .container {
                    max-width: 600px;
                    margin: 0 auto;
                    background-color: white;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
                }
                .header {
                    background-color: #007bff;
                    color: white;
                    padding: 5px;
                    text-align: center;
                    font-size: 18px;
                    font-weight: bold;
                    border-radius: 8px 8px 0 0;
                }
                .subject {
                    font-weight: bold;
                    font-size: 18px;
                    color: #007bff;
                    margin-top: 10px;
                }
                .message {
                    font-size: 16px;
                    line-height: 1.6;
                    background-color: #f8f9fa;
                    padding: 15px;
                    border-left: 4px solid #007bff;
                    border-radius: 4px;
                    margin-top: 10px;
                }
                .footer {
                    margin-top: 20px;
                    font-size: 14px;
                    text-align: center;
                    color: #555;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">New message from user ${name}</div>
                <div class="subject">📌 <strong>Subject:</strong> ${subject}</div>
                <div class="message">${message}</div>
                <div class="footer">This message was sent to you by a user from Exquisite Wears</div>
            </div>
        </body>
        </html>`
        };
        
        try {
            await transporter.sendMail(mailOptions);
            return res.status(200).json({ success: true, message: 'Message sent successfully!' });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Error sending email: ' + error });
        }
})

module.exports = router