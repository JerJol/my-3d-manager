import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';

const dbPath = join(homedir(), 'AppData', 'Roaming', 'v3', 'my3dmanager.db');
const db = new Database(dbPath);

const images = db.prepare('SELECT * FROM ProjectImages').all();
console.log(JSON.stringify(images, null, 2));
db.close();
