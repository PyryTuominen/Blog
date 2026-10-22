// Use a fresh in-memory database for every test run instead of blog.db
process.env.DB_PATH = ':memory:';

const request = require('supertest');
const app = require('../app');
const db = require('../database');

// Registers a user and logs in, returning the session cookie
async function registerAndLogin(username, password) {
    await request(app).post('/auth/register').type('form').send({ username, password });
    const res = await request(app).post('/auth/login').type('form').send({ username, password });
    return res.headers['set-cookie'];
}

function getUser(username) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => (err ? reject(err) : resolve(row)));
    });
}

function countPosts() {
    return new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) AS n FROM posts', (err, row) => (err ? reject(err) : resolve(row.n)));
    });
}

// ---------------------------------------------------------------------------
// Automatically generated tests (generated with Claude, reviewed before use)
// ---------------------------------------------------------------------------
describe('Automatically generated tests', () => {
    test('1. login page loads and shows a login form', async () => {
        const res = await request(app).get('/auth/login');
        expect(res.status).toBe(200);
        expect(res.text).toContain('<form action="/auth/login" method="post">');
    });

    test('2. front page redirects anonymous users to login', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
    });

    test('3. anonymous users cannot create posts', async () => {
        const before = await countPosts();
        const res = await request(app).post('/new-post').type('form').send({ title: 'spam', content: 'spam' });
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe('/auth/login');
        expect(await countPosts()).toBe(before);
    });

    test('4. admin page is forbidden for anonymous users', async () => {
        const res = await request(app).get('/admin');
        expect(res.status).toBe(403);
        expect(res.text).not.toContain('DISOBEY');
    });

    test('5. passwords are stored hashed, not in plain text', async () => {
        await request(app).post('/auth/register').type('form').send({ username: 'hashuser', password: 'Secret123!' });
        const user = await getUser('hashuser');
        expect(user).toBeDefined();
        expect(user.password).not.toBe('Secret123!');
        expect(user.password).toMatch(/^\$2[aby]\$/); // bcrypt hash prefix
    });

    test('6. successful login sets an HttpOnly session cookie', async () => {
        const cookies = await registerAndLogin('alice', 'alicepass');
        expect(cookies).toBeDefined();
        const session = cookies.find((c) => c.startsWith('sessionId='));
        expect(session).toBeDefined();
        expect(session).toMatch(/HttpOnly/i);
    });

    test('7. SQL injection in the login form does not log anyone in', async () => {
        await request(app).post('/auth/register').type('form').send({ username: 'victim', password: 'victimpass' });
        const res = await request(app)
            .post('/auth/login')
            .type('form')
            .send({ username: "victim' OR '1'='1", password: "' OR '1'='1" });
        expect(res.headers['set-cookie']).toBeUndefined();
        expect(res.text).toContain('Invalid username or password');
    });
});

// ---------------------------------------------------------------------------
// Manually written tests
// ---------------------------------------------------------------------------
describe('Manually written tests', () => {
    test('8. wrong password shows an error and sets no cookie', async () => {
        await request(app).post('/auth/register').type('form').send({ username: 'bob', password: 'rightpass' });
        const res = await request(app).post('/auth/login').type('form').send({ username: 'bob', password: 'wrongpass' });
        expect(res.headers['set-cookie']).toBeUndefined();
        expect(res.text).toContain('Invalid username or password');
    });

    test('9. a logged-in non-admin user is denied the admin page', async () => {
        const cookies = await registerAndLogin('charlie', 'charliepass');
        const res = await request(app).get('/admin').set('Cookie', cookies);
        expect(res.status).toBe(403);
        expect(res.text).not.toContain('DISOBEY');
    });

    test('10. a logged-in user can create a post that appears on the front page', async () => {
        const cookies = await registerAndLogin('dave', 'davepass');
        const create = await request(app).post('/new-post').type('form').set('Cookie', cookies)
            .send({ title: 'Hello', content: 'My first post' });
        expect(create.status).toBe(302);
        const front = await request(app).get('/').set('Cookie', cookies);
        expect(front.status).toBe(200);
        expect(front.text).toContain('Hello');
        expect(front.text).toContain('My first post');
    });
});
