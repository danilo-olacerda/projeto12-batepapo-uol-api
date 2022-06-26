import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";

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
const userSend = joi.object({
    to: joi.string().required()
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

server.post("/status", (req, res) => {
    
})

/* 


const limit = req.query.limit;

app.post("/usuarios", (req, res) => {
	// inserindo usuário
	db.collection("users")
      .insertOne({})
      .then(() => {
        res.send("koe");
        return;
      });
});


*/






server.listen(process.env.PORT);