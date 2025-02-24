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
        if (error.code === 11000) {
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
            pass: process.env.EMAIL_PASS
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
        const info = await mail.sendMail(mailOptions);
        console.log(`✅ Email sent successfully to ${to}:`, info.response);
        return { success: true };
    } catch (error) {
        console.error(`❌ Error sending email to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
};



const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const getSubscriber = async (subject, message) => {
    const subscribers = await Subscribe.find();
    const results = [];

    for (const subscriber of subscribers) {
        const result = await sendMail(subscriber.email, subject, message);
        results.push(result);
        await delay(2000); 
    }

    return results;
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
            return res.status(207).json({ // 207: Multi-Status (partial success)
                message: 'Some emails failed to send',
                failedEmails
            });
        }

        res.status(200).json({ message: 'Message sent successfully to all subscribers' });
    } catch (error) {
        console.error("Error sending notifications:", error);
        res.status(500).json({ message: 'Error sending notifications', error: error.message });
    }
});



module.exports = router