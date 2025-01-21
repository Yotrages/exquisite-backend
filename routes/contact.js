const express = require('express');
const nodemailer = require('nodemailer')
const router = express.Router()

router.post("/", async (req, res) => {
    console.log(req, "This is the request")
    const { name, email, subject, message } = req.body
    console.log(name, email, subject, message, "These are the data received from the backend")
    if(!name || !email || !subject || !message) {
        return res.status(400).json({
            success: false,
            message: "All fields are required"
        })
    }
        // Set up Nodemailer transporter
        let transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            service: 'gmail',
            auth: {
                user: process.env.EMAIL, // Use Vercel environment variables
                pass: process.env.EMAIL_PASS
            }
        });
    
        // Set up email options
        let mailOptions = {
            from: process.env.EMAIL,
            to: process.env.EMAIL, 
            subject: `Contact Form Submission: ${subject}`,
            text: `You have received a new message from ${name}. \n\n Email: ${email} \n Subject: ${subject} \n Message: \n ${message}`
        };
        try {
            await transporter.sendMail(mailOptions);
            return res.status(200).json({ success: true, message: 'Message sent successfully!' });
        } catch (error) {
            return res.status(500).json({ success: false, message: 'Error sending email: ' + error });
        }
})

module.exports = router