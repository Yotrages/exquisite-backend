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

    // dzwtdtminkriwdzc
    const mailOptions = {
        from: process.env.EMAIL,
        to,
        subject,
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
                <div class="header">New product notification from Exquisite Wears</div>
                <div class="subject">📌 ${subject}</div>
                <div class="message">${message}</div>
                <div class="footer">Thank you for subscribing to Exquisite Wears!</div>
            </div>
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