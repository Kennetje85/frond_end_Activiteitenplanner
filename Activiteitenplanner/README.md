**Project**

- **Naam:** Activiteitenplanner (React + TypeScript + Vite)
- **Map:** Activiteitenplanner/

Dit project is een frontend-applicatie geschreven in React + TypeScript (Vite). Tijdens ontwikkeling is er een eenvoudige Express fallback API in `server/` aanwezig; in productie of integratietests wordt een ASP.NET Core backend (in Docker) gebruikt.

**Inhoud van deze README**

- Overzicht
- Vereisten
- Lokale installatie & development
- Backend (lokaal Express) starten
- ASP.NET Core + Docker (production-like)
- Tests
- Troubleshooting & veelvoorkomende problemen
- Belangrijke localStorage-keys

## Vereisten

- Node.js 18+ (of een compatibele LTS)
- npm of yarn
- Voor de ASP.NET backend: Docker (indien je de container wil draaien)

## Installatie (frontend)

Open een terminal in de projectmap `Activiteitenplanner/` en voer uit:

```bash
npm install
```

## Frontend lokaal draaien (Vite)

Start de development server (met HMR):

```bash
npm run dev
```

De app is standaard bereikbaar op `http://localhost:5173` (of de poort die Vite toont).

## Lokaal backend (Express) voor development

Er is een eenvoudige Express server onder `server/` die als fallback/back-end voor development gebruikt kan worden.

Start deze met:

```bash
npm --prefix server install
npm --prefix server start
```

Standaard luistert de dev-server op `http://localhost:3000` (controleer `server/index.js` voor exacte poort).

## ASP.NET Core backend (Docker)

In sommige workflows gebruikt dit project een ASP.NET Core backend die in Docker draait. Een bekende containernaam uit dit project is `competent_joliot`.

Snelstart (voorbeeld):

```powershell
# Start SQL Server container (voorbeeld)
# Pas wachtwoord en opties aan in productie
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=Your_password123" --name sqlserver -d mcr.microsoft.com/mssql/server:2019-latest

# Start de ASP.NET container op hetzelfde netwerk en met connection string naar 'sqlserver'
# Stel ConnectionStrings__DefaultConnection als env var of via appsettings
docker run --name competent_joliot --network host -e ConnectionStrings__DefaultConnection="Server=sqlserver,1433;Database=MyDb;User Id=sa;Password=Your_password123;" -p 5000:80 -d your-aspnet-image
```

Controleer logs met:

```powershell
docker logs competent_joliot --tail 200
curl.exe -i http://localhost:5000/api/health
```

Let op: veel voorkomende fout is dat de ASP.NET app intern naar poort 80 luistert maar hostportmapping of connection strings niet goed staan ingesteld; zie Troubleshooting.

## Tests

Run unit/e2e tests (waar aanwezig):

```bash
npm test
```

Voor E2E-tests in `e2e/` volg de specifieke instructies in die map.

## Troubleshooting

- Registratie mislukt / backend geeft 500: controleer of de database bereikbaar is voor de ASP.NET container. Veel fouten ontstaan omdat EF Core geen verbinding kan maken met SQL Server (bijv. probleem met SQL Browser of verkeerde connection string).
- Health endpoint: `http://localhost:5000/api/health` (pas poort aan indien nodig).
- Double-slash API URLs: de frontend normaliseert `API_URL` om dubbele slashes te voorkomen; als je custom env vars gebruikt, zorg dat er geen trailing slash staat.
- Fallback: wanneer de backend niet bereikbaar is, gebruikt de app `localStorage` voor offline persistence (zie keys hieronder).

## Belangrijke localStorage-keys

- `industrieon-activiteiten` — opgeslagen activiteiten
- `industrieon-beheer-logs` — events/logs
- `industrieon-activity-owners` — mapping activiteit -> eigenaar

## Contributing / Debugging tips

- Als je backend-problemen onderzoekt, start met `docker ps` en `docker logs <container>` en controleer netwerk/connection strings.
- Gebruik `curl` of `Postman` om `POST /api/users` of `POST /api/registrations` direct te testen.

---

Als je wilt, kan ik deze README verder uitbreiden met:

- meer gedetailleerde API-endpoints die de frontend gebruikt
- voorbeelden van `curl` commands voor registratie en login
- snelle fix-commands voor het opzetten van Docker-netwerken

Laat me weten welke aanvullingen je wilt.

## API Endpoints (gebruik door frontend)

Standaard base URL: `http://localhost:5000/api` of de waarde van `VITE_API_URL`.

- GET `/activities` — lijst activiteiten
- GET `/activities/{id}` — haal 1 activiteit op
- POST `/activities` — maak activiteit aan
- PATCH `/activities/{id}` — update activiteit (deelnemers/registraties)
- DELETE `/activities/{id}` — verwijder activiteit

- GET `/registrations` — lijst registraties
- POST `/registrations` — maak registratie aan
- PATCH `/registrations/{id}` — update registratie
- DELETE `/registrations/{id}` — verwijder registratie

- GET `/polls` — lijst polls
- POST `/polls` — maak poll aan
- PATCH `/polls/{id}` — update poll

- GET `/logs` — beheerderslogs
- POST `/logs` — append log

- POST `/users` — register (antwoord bevat vaak `token`)
- POST `/users/login` — login (antwoord bevat `token`)
- POST `/login` — fallback login endpoint (oude API)

Deze endpoints worden aangeroepen door `src/api/api.ts`.

## Voorbeeld `curl` commands

Health check:

```bash
curl -i http://localhost:5000/api/health
```

Register (maak gebruiker en sla token op in response):

```bash
curl -i -H "Content-Type: application/json" -X POST http://localhost:5000/api/users -d '{"name":"Test","email":"test@example.com","password":"secret"}'
```

Login:

```bash
curl -i -H "Content-Type: application/json" -X POST http://localhost:5000/api/users/login -d '{"email":"test@example.com","password":"secret"}'
```

Maak activiteit aan (met JWT):

```bash
curl -i -H "Content-Type: application/json" -H "Authorization: Bearer <JWT>" -X POST http://localhost:5000/api/activities -d '{"title":"Workshop","description":"Test","date":"2026-05-21","time":"14:00","location":"HQ","participants":0,"participantsList":[],"registrations":[],"image":""}'
```

Registreer voor activiteit (upsert):

```bash
curl -i -H "Content-Type: application/json" -H "Authorization: Bearer <JWT>" -X POST http://localhost:5000/api/registrations -d '{"activityId":1,"userEmail":"test@example.com","userName":"Test","status":"zeker"}'
```

Stem (poll upsert):

```bash
curl -i -H "Content-Type: application/json" -H "Authorization: Bearer <JWT>" -X POST http://localhost:5000/api/polls -d '{"activityId":1,"userEmail":"test@example.com","userName":"Test","rating":5}'
```

## Tips voor `VITE_API_URL`

- Stel `VITE_API_URL` in de `.env` of in je dev-omgeving in als bijvoorbeeld `http://localhost:5000/api` (zonder trailing slash). De frontend verwijdert trailing slashes automatisch, maar het is duidelijker zonder.

## Snelle Docker / netwerk commands

Maak een netwerk en start SQL Server en ASP.NET containers op dat netwerk (voorbeeld):

```powershell
docker network create activiteiten-net
docker run -e "ACCEPT_EULA=Y" -e "MSSQL_SA_PASSWORD=Your_password123" --name sqlserver --network activiteiten-net -d mcr.microsoft.com/mssql/server:2019-latest
docker run --name competent_joliot --network activiteiten-net -e ConnectionStrings__DefaultConnection="Server=sqlserver,1433;Database=MyDb;User Id=sa;Password=Your_password123;" -p 5000:80 -d your-aspnet-image
```

Controleer logs en health endpoint:

```powershell
docker ps --filter name=competent_joliot
docker logs competent_joliot --tail 200
curl -i http://localhost:5000/api/health
```

---

