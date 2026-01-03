require('dotenv').config();
const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');

const app = express();

app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

app.get('/api/auth/login',(req,res)=>{
  const params=new URLSearchParams({
    client_id:process.env.DISCORD_CLIENT_ID,
    redirect_uri:process.env.DISCORD_REDIRECT_URI,
    response_type:'code',
    scope:'identify email'
  });
  res.redirect('https://discord.com/api/oauth2/authorize?'+params);
});

app.get('/api/auth/callback',async(req,res)=>{
  const code=req.query.code;
  const token=await fetch('https://discord.com/api/oauth2/token',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      client_id:process.env.DISCORD_CLIENT_ID,
      client_secret:process.env.DISCORD_CLIENT_SECRET,
      grant_type:'authorization_code',
      code,
      redirect_uri:process.env.DISCORD_REDIRECT_URI
    })
  }).then(r=>r.json());

  const user=await fetch('https://discord.com/api/users/@me',{
    headers:{Authorization:`Bearer ${token.access_token}`}
  }).then(r=>r.json());

  req.session.user={
    id:user.id,
    username:user.username,
    discriminator:user.discriminator,
    avatar:user.avatar?`https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`:null
  };

  res.redirect('/');
});

app.get('/api/auth/user',(req,res)=>{
  if(!req.session.user) return res.json({loggedIn:false});
  res.json({loggedIn:true,user:req.session.user});
});

app.get('/api/auth/logout',(req,res)=>{
  req.session.destroy(()=>res.redirect('/'));
});

app.post('/api/order',(req,res)=>{
  if(!req.session.user) return res.status(401).json({error:'Nicht eingeloggt'});
  const {age,botDescription,rulesAccepted}=req.body;
  if(!rulesAccepted) return res.status(400).json({error:'Regeln akzeptieren'});
  console.log('BESTELLUNG:',req.session.user,age,botDescription);
  res.json({success:true});
});

app.listen(3000,()=>console.log('http://localhost:3000'));
