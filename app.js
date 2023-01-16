const { Client } = require('whatsapp-web.js');
const express = require('express');
const { body, validationResult } = require("express-validator");
const socketIO = require('socket.io');
const qrcode = require('qrcode');
const http = require('http');
const { phoneNumberFormatter } = require("./helpers/formatter");

const port = process.env.PORT || 8000;

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.sendFile("index.html", { root: __dirname });
});

const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            "--single-process", // <- this one doesn't works in Windows
            "--disable-gpu",
            ],
        },
    });

client.on('message', msg => {
    if (msg.body == '!ping') {
        msg.reply('pong');
    }
});

client.initialize();

//Socket IO
io.on("connection", function (socket) {
    socket.emit("message", "STARTING..");

        client.on("qr", (qr) => {
        //Generate and scan this code with youre phone
        console.log("QR RECEIVED", qr);
        qrcode.toDataURL(qr, (err, url) => {
            socket.emit("qr", url);
            socket.emit("message", "QR Code Received, Scan QR Please");
        });
        });
    
        client.on("ready", () => {
        socket.emit("ready", "Whatsapp Running");
        socket.emit("message", "Whatsapp Running");
        });
    
        client.on("authenticated", () => {
        socket.emit("ready", "Whatsapp is authenticated!");
        socket.emit("message", "Whatsapp is authenticated!");
        console.log("AUTHENTICATED");
        });
    });

// send message;
    app.post("/send-message", [body("number").notEmpty(), body("message").notEmpty()],
        async (req, res) => {
        const errors = validationResult(req).formatWith(({ msg }) => {
            return msg;
        });
    
        if (!errors.isEmpty()) {
            return res.status(422).json({
            status: false,
            message: errors.mapped(),
            });
        }
    
        const number = phoneNumberFormatter(req.body.number);
        const message = req.body.message;
    
        client.sendMessage(number, message).then((response) => {
            res.status(200).json({
                status: true,
                response: response,
            });
            })
            .catch((err) => {
            res.status(500).json({
                status: false,
                response: err,
            });
            });
        }
    );

    server.listen(port, function () {
        console.log("App running on port *:" + port);
    });