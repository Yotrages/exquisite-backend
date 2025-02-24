const nodemailer = require('nodemailer');
const express = require('express')
const router = express.Router()
const Subscribe = require('../Models/Subscribe')

router.post('/', async (req, res) => {
    const { email } = req.body;
    const subscribe = new Subscribe({ email });
    await subscribe.save()

    try {
        res.status(201).json({ message: 'Subscription successful'})
    } catch (error) {
        if (error.code === 1100) {
            res.status(400).json({ message: 'Email already in use' });  
        }
        res.status(500).json({ message: 'Server error, subscription failed'})
    }
    
})

const sendMail = async (to, subject, message) => {
    const mail = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL,
        to,
        subject,
        html: `
        <html>
        <head>
            <style>
                .subject { font-style: italic; font-weight: 800; font-size: 17px; }
                .message { font-weight: 600; background-color: #f2f2f2; color: black; letter-spacing: 1.5px; }
                body { background-color: black; color: white; padding: 10px; }
            </style>
        </head>
        <body>
            <div class="subject"><span style="color: green;">Subject:</span> ${subject}</div>
            <div class="message">${message}</div>
        </body>
        </html>`
    };

    try {
        await mail.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error("Error sending email:", error);
        return { success: false, error };
    }
};


const getSubscriber = async (subject, message) => {
    const subscribers = await Subscribe.find();
    const emailPromises = subscribers.map((subscriber) => sendMail(subscriber.email, subject, message));

    return await Promise.all(emailPromises);
};


router.post('/notify', async (req, res) => {
    const { subject, message } = req.body;

    if (!subject || !message) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        const results = await getSubscriber(subject, message);

        const failedEmails = results.filter(result => !result.success);

        if (failedEmails.length > 0) {
            return res.status(500).json({
                message: 'Some emails failed to send',
                errors: failedEmails
            });
        }

        res.status(201).json({ message: 'Message sent successfully to all subscribers' });
    } catch (error) {
        console.error("Error sending notifications:", error);
        res.status(500).json({ message: 'Error sending notifications', error: error.message });
    }
});


module.exports = router