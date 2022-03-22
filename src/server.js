const ws = require('ws');
const uuid = require('uuid');
const Koa = require('koa');
const port = process.env.PORT || 7284;


const app = new Koa();
const wsServer = new ws.Server({port});


const currentClients = [];
const messages = [];
const client = [];

app.use(async (ctx, next) => {
    const origin = ctx.request.get('Origin');
    if (!origin) {
        return await next();
    }

    const headers = {'Access-Control-Allow-Origin': '*'};

    if (ctx.request.method !== 'OPTIONS') {
        ctx.response.set({...headers});
        try {
            return await next();
        } catch (e) {
            e.headers = {...e.headers, ...headers};
            throw e;
        }
    }

    if (ctx.request.get('Access-Control-Request-Method')) {
        ctx.response.set({
            ...headers,
            'Access-Control-Allow-Methods': 'GET, POST, DELETE',
        });

        if (ctx.request.get('Access-Control-Request-Headers')) {
            ctx.response.set(
                'Access-Control-Allow-Headers',
                ctx.request.get('Access-Control-Request-Headers'),
            );
        }
        ctx.response.status = 204;
    }
});


wsServer.on('connection', (ws) => {
    const id = uuid.v4();
    client[id] = ws;

    ws.on('message', (rawMessage) => {
        const {userName} = JSON.parse(rawMessage);
        if (userName) {
            if (currentClients.findIndex(item => item.name === userName) > -1) {
                client[id].send(JSON.stringify({successName: false}));
                return;
            } else {
                currentClients.push({id, name: `${userName}`});
                client.push(client[id]);
                client[id].send(JSON.stringify({successName: true}));
                currentClients.forEach(item => {
                    if (item.id === id) return;
                    client[id].send(JSON.stringify({startApp:item.name}));
                });
                client.filter(item => item !== client[id]).forEach(item => item.send(JSON.stringify({startApp:userName})));
                return;
            }
        }
        const {name, dateTime, message} = JSON.parse(rawMessage);
        messages.push({name, dateTime, message});
        client.filter(item => item !== client[id]).forEach(item => {
            item.send(JSON.stringify([{name, dateTime, message}]));
        });
    })
    ws.on('close', () => {
        const ind = currentClients.findIndex(item => item.id === id);
        let name;
        if (ind > -1) {
           name = currentClients[ind].name;
            currentClients.splice(ind, 1);
        }
        const index = client.findIndex(item => item === client[id]);
        if (index > -1) {
            client.splice(index, 1);
        }
        client.forEach(item => {
            item.send(JSON.stringify({logOut: true, name}));
        });
    })
})
