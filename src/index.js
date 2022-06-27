import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";
import { stripHtml } from "string-strip-html";

dotenv.config();

const client = new MongoClient(process.env.URL_CONNECT_MONGO);
let db;

const userSchema = joi.object({
    name: joi.string().required()
});
const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message','private_message').required()
});

client.connect().then(() => {
	db = client.db("batepapoUol");
});

const server = express();
server.use(cors());
server.use(express.json());


server.post("/participants", async (req, res)=>{

    const validation = userSchema.validate(req.body);

    if (validation.error){
        res.status(422);
        res.send(validation.error.details);
        return;
    }

    const verifyUserExist = await db.collection("participants").findOne({name: req.body.name});

    if (verifyUserExist){
        res.status(409);
        res.send("Nome de usuário já está sendo utilizado!");
        return;
    }

    const newUser = {
        name: req.body.name, 
        lastStatus: Date.now()
    };

    const loginMessage = {from: req.body.name, to: 'Todos', text: 'entra na sala...', type: 'status', time: `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`};

    await db.collection("participants").insertOne(newUser);
    await db.collection("messages").insertOne(loginMessage);

    res.sendStatus(201);
});
server.get("/participants", async (_, res)=> {
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
});

server.post("/messages", async (req, res)=>{
    const validation = messageSchema.validate(req.body);
    const user = req.headers.user;
    const verifyUserExist = await db.collection("participants").findOne({name: user});

    if (validation.error){
        res.status(422);
        res.send(validation.error.details);
        return;
    }
    if (!verifyUserExist){
        res.status(422);
        res.send("Usuário que enviou a mensagem deve estar logado!");
        return;
    }

    req.body.text = stripHtml(req.body.text).result;
    req.body.text = req.body.text.trim();

    const newMessage = {
        ...req.body,
        from: user,
        time: `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`
    };

    await db.collection("messages").insertOne(newMessage);

    res.sendStatus(201);
});
server.get("/messages", async (req, res) => {
    const limit = req.query.limit;
    const user = req.headers.user;

    let messages = await db.collection("messages").find({ $or: [ { to: user }, { from: user }, {to: "Todos"}, {type: "message"} ] }).toArray();
    messages.reverse();

    if(limit)
    messages = messages.slice(0, limit);

    messages.reverse();

    res.send(messages);
});

server.post("/status", async (req, res) => {
    const user = req.headers.user;
    const verifyUserExist = await db.collection("participants").findOne({name: user});

    if(!verifyUserExist){
        res.sendStatus(404);
        return;
    }

    await db.collection("participants").updateOne({name: user}, {$set: {lastStatus: Date.now()}});
    res.sendStatus(200);
});

server.delete("/messages/:ID_DA_MENSAGEM", async (req, res) => {
    const user = req.headers.user;
    const msg = req.params.ID_DA_MENSAGEM;

    try {

        const userMatch = await db.collection("messages").findOne({ _id: new ObjectId(msg) });

        if (userMatch.from === user){
            await db.collection("messages").deleteOne({ _id: new ObjectId(msg) });
            res.sendStatus(200);
        } else {
            res.sendStatus(401);
        }
        
    } catch (error) {
        res.sendStatus(404);
        return;
    }
});
server.put("/messages/:ID_DA_MENSAGEM", async (req, res)=>{
    const idMsg = req.params.ID_DA_MENSAGEM;
    const validation = messageSchema.validate(req.body);
    const from = req.headers.user;

    if (validation.error){
        res.status(422);
        res.send(validation.error.details);
        return;
    }
    try {
        const msg = await db.collection("messages").findOne({ _id: new ObjectId(idMsg) });
        req.body = {
            ...req.body,
            time: `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`
        }

        if (msg.from!==from){
            res.sendStatus(401);
            return;
        } else {
            await db.collection("messages").updateOne({ _id: new ObjectId(idMsg) }, {$set: req.body});
            return;
        }
        
    } catch (error) {
        res.sendStatus(404);
        return;
    }

});

setInterval(async ()=>{
    const participants = await db.collection("participants").find().toArray();
    participants.map(async (el) => {
        if (Date.now() - el.lastStatus > 10000){
            const unLoginMessage = {from: el.name, to: 'Todos', text: 'sai da sala...', type: 'status', time: `${dayjs().hour()}:${dayjs().minute()}:${dayjs().second()}`};
            await db.collection("participants").deleteOne({name: el.name});
            await db.collection("messages").insertOne(unLoginMessage);
        }
    })
}, 15000);


server.listen(process.env.PORT);