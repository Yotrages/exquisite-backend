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

router.post('/notify', async (req, res) => {
    const { subject, message} = req.body;

    if (!subject || !message) {
        return res.status(404).json({ message: 'All fields are required'})
    }

    try {
        await getSubscriber(subject, message)
        res.status(201).json({ message: 'Message sent successfully' })
    } catch (error) {
     res.status(500).json({ message: 'Error sending notifications' })   
    }

    const sendMail = async (to, subject, message) => {
        const mail = nodemailer.createTransport({
            service: 'gmail',
            auth: [{
                user: process.env.EMAIL,
                pass: process.env.PASS
            }]
        })
    
        const mailOptions = ({
            from: process.env.EMAIL,
            to,
            subject,
            text: message
        })
        
        try {
            await mail.sendMail(mailOptions)
            res.status(200).json({ message : 'Message sent successfully'})
        } catch (error) {
            if (error.code === 1100) {
                res.status(1100).json({ message: 'Email already subscribed'})
            } else {
                res.status(500).json({ message: 'Server not responding'})
            }
        }
    }
    
    const getSubscriber = async (subject, message) => {
        const subscribers = await Subscribe.find();
        for (const subscriber of subscribers) {
            sendMail(subscriber.email, subject, message)
        }
    }
})