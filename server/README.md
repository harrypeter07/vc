# Socket.IO Server Deployment on Render

This folder contains the standalone Socket.IO server for your video call app.

## 🚀 Deploying to Render

1. **Create a new Web Service** on [Render](https://render.com/).
2. **Connect your GitHub repository** (or upload your code).
3. **Set the root directory to `server`** (in the Render dashboard, set the "Root Directory" field to `server`).
4. **Set the Build and Start Commands:**
   - **Build Command:**
     ```
     npm install
     ```
     (or leave blank, since `postinstall` will run `npm run build`)
   - **Start Command:**
     ```
     npm start
     ```
5. **Environment:**
   - Node version: 18+ (default is fine)
   - Port: Use Render's `$PORT` environment variable (your code already uses `process.env.PORT`)

## 🔗 Client Connection

After deployment, Render will provide a public URL for your service, e.g.:

```
https://your-render-service.onrender.com
```

Update your client app to connect to this URL:

```js
const newSocket = io("https://your-render-service.onrender.com", {
  path: "/socketio",
  ...
});
```

## 📦 Folder Structure

- `server.ts` — Entry point for the Socket.IO server
- `socket.ts` — Socket.IO logic and handlers
- `package.json` — Server dependencies and scripts
- `tsconfig.json` — TypeScript configuration

## 🛠️ Useful Commands

- **Build:**
  ```
  npm run build
  ```
- **Start:**
  ```
  npm start
  ```

---

**Deploy only the `server` folder as a Node.js web service on Render.**

For any issues, check the Render logs or open an issue in your repository.
