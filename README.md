# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Setting Up Your Users

To use the application, you first need to create the initial admin and shopkeeper users in your Firebase project.

**IMPORTANT**: Before running the script, you must create a service account for your Firebase project and download the JSON key file.

1.  Go to your Firebase Project Settings > Service accounts.
2.  Click "Generate new private key" and save the JSON file.
3.  Rename the downloaded file to `serviceAccountKey.json` and place it in the root directory of this project.
4.  Make sure your `.gitignore` file includes `serviceAccountKey.json` to keep your key secure.

Once the service account key is in place, run the following command to create the users:

```bash
npm run seed-users
```

This will create two users:
- **Admin**: Phone `03363856003`, Password `password123`
- **Shopkeeper**: Phone `03110349230`, Password `password123`
