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
            html: `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title></title>
        </head>
        <style>
            .name {
                color: white;
                font-style: italic;
            }
            .subject {
                font-style: italic;
                font-weight: 800;
                font-size: 17px;
            }
            .message {
                font-weight: 600;
                background-color: #f2f2f2;
                color: black !important;
                letter-spacing: 1.5px;
            }
            body {
                background-color: black;
                display: flex;
                flex-direction: column;
                gap: 5px;
                color: white;
                padding-left: 10px;
                padding-right: 10px;
                padding-top: 8px;
                padding-bottom: 8px;
                height: fit-content;
            }
        </style>
        <body>
            <div class="name">You have received a new message from ${name}</div>
            <div class="subject"><span style="color: green;">Subject:</span> ${subject}</div>
            <div class="message">${message}</div>
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