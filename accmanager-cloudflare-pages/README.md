# AccManager - Cloudflare Pages Edition

A secure, self-hosted accounts and secrets manager with Zero-Trust encryption. This version is designed for deployment entirely on Cloudflare's infrastructure (Pages + Workers + D1).

## 🚀 Quick Start Guide

This guide will walk you through deploying AccManager from scratch. Total setup time: ~15 minutes.

---

## Prerequisites

Before you begin, ensure you have:

1. **A Cloudflare account** (free tier works fine)
2. **Node.js** installed (v18 or higher)
3. **Git** installed
4. **Wrangler CLI** installed: `npm install -g wrangler`

---

## Part 1: Database Setup (5 minutes)

### Step 1.1: Login to Wrangler

```bash
wrangler login
```

This will open your browser. Log in to your Cloudflare account.

### Step 1.2: Create D1 Database

```bash
wrangler d1 create accmanager-db
```

**IMPORTANT**: Copy the output! You'll see something like:

```
✅ Successfully created DB 'accmanager-db'!

[[d1_databases]]
binding = "DB"
database_name = "accmanager-db"
database_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  <-- COPY THIS!
```

**Save this `database_id` somewhere safe. You'll need it in Step 2.**

### Step 1.3: Initialize Database Schema

```bash
cd worker
wrangler d1 execute accmanager-db --file=schema.sql
```

You should see: `✅ Executed 6 commands in X.XXs`

---

## Part 2: Worker Configuration (3 minutes)

### Step 2.1: Configure wrangler.toml

1. Navigate to the `worker` folder
2. Copy the example file:
   ```bash
   cp wrangler.toml.example wrangler.toml
   ```

3. Open `wrangler.toml` in your editor

4. **Update line 8** with your database_id from Step 1.2:
   ```toml
   database_id = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"  # Replace with YOUR database_id
   ```

5. **Optional**: Change the worker name on line 1:
   ```toml
   name = "accmanager-worker"  # Change to something unique like "my-vault-worker"
   ```

### Step 2.2: Configure Environment Variables (Optional - for password reset emails)

If you want password reset functionality, set up SMTP secrets:

```bash
wrangler secret put SMTP_HOST
# Enter your SMTP server (e.g., smtp.gmail.com)

wrangler secret put SMTP_PORT
# Enter port (e.g., 587)

wrangler secret put SMTP_USER
# Enter your email

wrangler secret put SMTP_PASS
# Enter your email password or app-specific password

wrangler secret put SMTP_FROM
# Enter the "from" email address
```

**Skip this if you don't need email functionality right now. You can add it later.**

---

## Part 3: Frontend Configuration (2 minutes)

### Step 3.1: Configure Environment Variables

1. Navigate to the `frontend` folder

2. Create a file named `.env.production.local`:
   ```bash
   touch .env.production.local
   ```

3. Open it and add:
   ```
   VITE_API_BASE_URL="https://accmanager-worker.YOUR-USERNAME.workers.dev"
   ```

**Replace:**
- `accmanager-worker` with your worker name from Step 2.1
- `YOUR-USERNAME` with your Cloudflare username (you'll find this in your Cloudflare dashboard)

**Don't know your worker URL yet?** 
- Complete Part 4 first, then come back and update this file
- Then rebuild: `npm run build`

---

## Part 4: Deploy to Cloudflare (5 minutes)

### Step 4.1: Deploy the Worker

```bash
cd worker
npm install
npx wrangler deploy
```

**After deployment, you'll see:**
```
✨ Uploaded accmanager-worker
✨ Published accmanager-worker
  https://accmanager-worker.your-username.workers.dev  <-- COPY THIS URL!
```

**Copy this URL** and update your frontend `.env.production.local` file (see Step 3.1).

### Step 4.2: Build Frontend

```bash
cd ../frontend
npm install
npm run build
```

This creates a `dist` folder with your production-ready frontend.

### Step 4.3: Deploy to Cloudflare Pages

**Option A: Via Dashboard (Recommended for beginners)**

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Click **Workers & Pages** → **Create application** → **Pages** → **Upload assets**
3. Name your project (e.g., `accmanager`)
4. Drag and drop the entire `frontend/dist` folder
5. Click **Deploy site**

**Option B: Via Wrangler CLI**

```bash
npx wrangler pages deploy dist --project-name=accmanager
```

---

## Part 5: First-Time Setup

### Step 5.1: Access Your Application

Open the URL from Step 4.3 (e.g., `https://accmanager.pages.dev`)

### Step 5.2: Create Admin Account

You'll see the admin setup screen. Enter:
- **Username**: Your desired admin username
- **Email**: Your email address
- **Password**: A strong master password (REMEMBER THIS! It cannot be recovered)

Click **Create Admin Account**.

### Step 5.3: Login

You'll be redirected to the login page. Use the credentials you just created.

### Step 5.4: Unlock Your Vault

Enter your master password to unlock the vault. Your vault will stay unlocked for 15 minutes.

---

## 🎉 You're Done!

Your AccManager instance is now live and ready to use!

---

## 📖 Usage Guide

### Adding Accounts

1. Click **"Add Entry"** on the Accounts page
2. Fill in the details (Name, Email, Password, etc.)
3. Optionally add 2FA secret for automatic code generation
4. Click **Save**

### Viewing Passwords

- All passwords are visible once your vault is unlocked
- Click the copy button to copy email, password, or 2FA code

### 2FA Codes

- If you add a 2FA secret, AccManager automatically generates TOTP codes
- The code updates every 30 seconds
- Click the copy button to use it

### Admin Panel (Admin users only)

Access via the top navigation. You can:
- View all users
- Reset user passwords
- Delete user accounts
- Export/import data

---

## 🔧 Configuration Reference

### Environment Variables (Frontend)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Worker API URL | `https://worker.username.workers.dev` |

### Secrets (Worker)

| Secret | Description | Required |
|--------|-------------|----------|
| `SMTP_HOST` | SMTP server hostname | No (only for password reset) |
| `SMTP_PORT` | SMTP server port | No |
| `SMTP_USER` | SMTP username | No |
| `SMTP_PASS` | SMTP password | No |
| `SMTP_FROM` | From email address | No |

### Database

The D1 database is automatically configured via `wrangler.toml`.

---

## 🛠️ Maintenance & Updates

### Update the Worker

```bash
cd worker
npx wrangler deploy
```

### Update the Frontend

```bash
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=accmanager
```

### Backup Your Data

Via Admin Panel:
1. Go to Admin Panel
2. Click **"Export Data"**
3. Save the JSON file securely

Via CLI:
```bash
wrangler d1 export accmanager-db --output=backup.sql
```

### Restore from Backup

Via Admin Panel:
1. Go to Admin Panel
2. Click **"Import Data"**
3. Select your backup JSON file

---

## 🔒 Security Best Practices

1. **Use a strong master password** - It's the key to all your data
2. **Enable 2FA on your Cloudflare account** - Protects your deployment
3. **Regularly export backups** - Store them encrypted in a safe place
4. **Don't share your master password** - Even admins can't recover it
5. **Use HTTPS only** - Cloudflare provides this automatically
6. **Review access logs** - Check your Cloudflare dashboard regularly

---

## ⚙️ Advanced Configuration

### Custom Domain

1. Add your domain to Cloudflare
2. Go to Pages project → **Custom domains**
3. Add your domain
4. Update `VITE_API_BASE_URL` in frontend and rebuild

### Custom Worker Route

1. Go to Workers & Pages → Your worker
2. Click **Triggers** → **Add Custom Domain**
3. Add your custom domain/subdomain

---

## 🐛 Troubleshooting

### "Failed to connect to API"

- Check `VITE_API_BASE_URL` in `.env.production.local`
- Verify worker is deployed: `wrangler deployments list`
- Check worker logs: `wrangler tail`

### "Database not found"

- Verify `database_id` in `wrangler.toml`
- Run schema again: `wrangler d1 execute accmanager-db --file=schema.sql`

### "CPU time limit exceeded"

- This shouldn't happen with the optimized PBKDF2 (100 iterations)
- If it does, check worker logs for specific errors

### "Vault asks for unlock on every refresh"

- This is normal behavior for maximum security
- Vault stays unlocked for 15 minutes within a session
- SessionStorage is used to persist within the same tab

---

## 📚 Additional Resources

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [D1 Database Documentation](https://developers.cloudflare.com/d1/)
- [Report Issues](https://github.com/yourusername/accmanager/issues)

---

## 📄 License

[Add your license here]

---

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines first.

---

**Built with ❤️ for privacy and security**
