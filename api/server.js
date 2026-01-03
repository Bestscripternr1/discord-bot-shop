const express = require('express');
const session = require('express-session');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

app.use(session({
  secret: process.env.SESSION_SECRET || 'dein-geheimer-schlüssel-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

const CONFIG = {
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID || '1457047205117690122',
  DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
  DISCORD_REDIRECT_URI: process.env.DISCORD_REDIRECT_URI,
  EMAIL_USER: process.env.EMAIL_USER || 'samuelsingh368@gmail.com',
  EMAIL_PASS: process.env.EMAIL_PASS,
  EMAIL_TO: process.env.EMAIL_TO || 'samuelsingh368@gmail.com'
};

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: CONFIG.EMAIL_USER,
    pass: CONFIG.EMAIL_PASS
  }
});

app.get('/api/auth/login', (req, res) => {
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${CONFIG.DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(CONFIG.DISCORD_REDIRECT_URI)}&response_type=code&scope=identify%20email`;
  res.redirect(discordAuthUrl);
});

app.get('/api/auth/callback', async (req, res) => {
  const code = req.query.code;
  
  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: CONFIG.DISCORD_CLIENT_ID,
        client_secret: CONFIG.DISCORD_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: CONFIG.DISCORD_REDIRECT_URI
      })
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('Token Error:', tokenData);
      return res.redirect('/?error=no_token');
    }

    const userResponse = await fetch('https://discord.com/api/users/@me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const userData = await userResponse.json();

    req.session.user = {
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator || '0',
      avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png',
      email: userData.email
    };

    res.redirect('/?login=success');

  } catch (error) {
    console.error('Auth Error:', error);
    res.redirect('/?error=auth_failed');
  }
});

app.get('/api/auth/user', (req, res) => {
  if (req.session.user) {
    res.json({ loggedIn: true, user: req.session.user });
  } else {
    res.json({ loggedIn: false });
  }
});

app.get('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.post('/api/order', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Nicht eingeloggt' });
  }

  const { age, botDescription, rulesAccepted } = req.body;

  if (!age || !botDescription || !rulesAccepted) {
    return res.status(400).json({ error: 'Alle Felder erforderlich' });
  }

  const user = req.session.user;
  const orderData = {
    discordUsername: `${user.username}#${user.discriminator}`,
    discordId: user.id,
    email: user.email || 'Keine Email',
    age: age,
    botDescription: botDescription,
    timestamp: new Date().toISOString()
  };

  try {
    const mailOptions = {
      from: CONFIG.EMAIL_USER,
      to: CONFIG.EMAIL_TO,
      subject: `🤖 Neue Bot-Bestellung von ${orderData.discordUsername}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #5865F2, #7289DA); color: white; padding: 30px; text-align: center; border-radius: 10px; }
            .content { background: #f9f9f9; padding: 30px; margin-top: 20px; border-radius: 10px; }
            .info-box { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #5865F2; border-radius: 5px; }
            .bot-description { background: white; padding: 20px; margin: 15px 0; border-radius: 5px; border: 2px solid #e0e0e0; white-space: pre-wrap; }
            .price { background: #4CAF50; color: white; padding: 15px; text-align: center; font-size: 1.3em; font-weight: bold; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🤖 Neue Bot-Bestellung!</h1>
          </div>
          
          <div class="content">
            <h2>👤 Kundendaten:</h2>
            
            <div class="info-box">
              <strong>Discord:</strong> ${orderData.discordUsername}
            </div>
            
            <div class="info-box">
              <strong>Discord ID:</strong> ${orderData.discordId}
            </div>
            
            <div class="info-box">
              <strong>Email:</strong> ${orderData.email}
            </div>
            
            <div class="info-box">
              <strong>Alter:</strong> ${orderData.age} Jahre
            </div>
            
            <h2>📝 Bot-Beschreibung:</h2>
            <div class="bot-description">${orderData.botDescription}</div>
            
            <div class="price">💰 Preis: 15€</div>
            
            <div class="info-box">
              <strong>⏰ Zeitpunkt:</strong> ${new Date(orderData.timestamp).toLocaleString('de-DE')}
            </div>
            
            <p style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin-top: 20px;">
              ✅ Der Kunde hat bestätigt, dass der Bot nicht gegen Discord-Regeln verstößt.
            </p>
          </div>
          
          <div class="footer">
            <p>Discord Bot Shop © 2025</p>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    
    console.log('✅ Bestellung von:', orderData.discordUsername);
    
    res.json({ 
      success: true, 
      message: 'Bestellung erfolgreich!' 
    });

  } catch (error) {
    console.error('❌ Email Error:', error);
    res.status(500).json({ 
      error: 'Fehler beim Senden der Email' 
    });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
  });
}
