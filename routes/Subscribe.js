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
        service: 'gmail',
        auth: {
            user: process.env.EMAIL,
            pass: process.env.PASS
        }
    });

    const mailOptions = {
        from: process.env.EMAIL,
        to,
        subject,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title></title>
</head>
<style>
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
    body{
        background-color: black;
        display: flex;
        flex-direction: column;
        gap: 5px;
        color: white;
        padding: 10px;
        height: fit-content;
    }
</style>
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
    const promises = subscribers.map(subscriber =>
        sendMail(subscriber.email, subject, message)
    );
    return Promise.all(promises);
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
                failedEmails
            });
        }

        res.status(201).json({ message: 'Message sent successfully' });
    } catch (error) {
        console.error("Error sending notifications:", error);
        res.status(500).json({ message: 'Error sending notifications', error: error.message });
    }
});

module.exports = router