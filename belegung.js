// ============================================================
// Belegungstabelle aus Google Sheets
// ============================================================

const SHEET_ID = "1TpL4K5azf7XJZzhjkSWnBzh40sGfJlGJw6Ev4WTy1mA";

// Liest ausschließlich den gewünschten Zellbereich F9:I676.
// Google verwendet das erste Tabellenblatt, sofern keine gid angegeben ist.
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&range=F9:I676`;

const searchInput = document.getElementById("occupancy-search");
const tableBody = document.getElementById("occupancy-table-body");
const statusElement = document.getElementById("occupancy-status");

let occupancyRows = [];


// CSV-Parser: berücksichtigt auch durch Anführungszeichen geschützte Kommas
// und Zeilenumbrüche innerhalb einzelner Tabellenfelder.
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (char === '"') {
            if (insideQuotes && next === '"') {
                field += '"';
                i++;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (char === "," && !insideQuotes) {
            row.push(field);
            field = "";
        } else if ((char === "\n" || char === "\r") && !insideQuotes) {
            if (char === "\r" && next === "\n") i++;
            row.push(field);
            if (row.some(value => value.trim() !== "")) rows.push(row);
            row = [];
            field = "";
        } else {
            field += char;
        }
    }

    row.push(field);
    if (row.some(value => value.trim() !== "")) rows.push(row);

    return rows;
}


function normalizeHeader(value) {
    return String(value || "")
        .trim()
        .toLocaleLowerCase("de-DE")
        .replace(/[ä]/g, "a")
        .replace(/[ö]/g, "o")
        .replace(/[ü]/g, "u")
        .replace(/[ß]/g, "ss")
        .replace(/[^a-z0-9]/g, "");
}


function findColumn(headers, possibleNames, fallbackIndex) {
    const normalizedHeaders = headers.map(normalizeHeader);
    const index = normalizedHeaders.findIndex(header => possibleNames.includes(header));
    return index >= 0 ? index : fallbackIndex;
}


function setStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.classList.toggle("error", isError);
}


function appendHighlightedText(cell, text, query) {
    const value = String(text ?? "");

    if (!query) {
        cell.textContent = value;
        return;
    }

    const lowerValue = value.toLocaleLowerCase("de-DE");
    const lowerQuery = query.toLocaleLowerCase("de-DE");
    let currentIndex = 0;
    let matchIndex = lowerValue.indexOf(lowerQuery, currentIndex);

    while (matchIndex !== -1) {
        cell.appendChild(document.createTextNode(value.slice(currentIndex, matchIndex)));

        const mark = document.createElement("mark");
        mark.textContent = value.slice(matchIndex, matchIndex + query.length);
        cell.appendChild(mark);

        currentIndex = matchIndex + query.length;
        matchIndex = lowerValue.indexOf(lowerQuery, currentIndex);
    }

    cell.appendChild(document.createTextNode(value.slice(currentIndex)));
}


function renderTable() {
    const query = searchInput.value.trim();
    const filteredRows = occupancyRows.filter(row =>
        row.some(value => String(value).toLocaleLowerCase("de-DE").includes(query.toLocaleLowerCase("de-DE")))
    );

    tableBody.replaceChildren();

    if (filteredRows.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.className = "placeholder";
        td.textContent = query ? "Keine passenden Einträge gefunden." : "Keine Belegungsdaten vorhanden.";
        tr.appendChild(td);
        tableBody.appendChild(tr);
    } else {
        for (const row of filteredRows) {
            const tr = document.createElement("tr");

            for (let column = 0; column < 4; column++) {
                const td = document.createElement("td");
                appendHighlightedText(td, row[column], query);
                tr.appendChild(td);
            }

            tableBody.appendChild(tr);
        }
    }

    const countText = query
        ? `${filteredRows.length} von ${occupancyRows.length} Einträgen gefunden`
        : `${occupancyRows.length} Einträge geladen`;
    setStatus(countText);
}


async function loadOccupancyData() {
    setStatus("Lade Belegungsdaten ...");

    try {
        const response = await fetch(SHEET_CSV_URL, { cache: "no-store" });

        if (!response.ok) {
            throw new Error(`Google Sheets antwortet mit HTTP ${response.status}.`);
        }

        const contentType = response.headers.get("content-type") || "";
        const csvText = await response.text();

        if (contentType.includes("text/html") || /<html[\s>]/i.test(csvText.slice(0, 500))) {
            throw new Error("Google liefert keine CSV-Daten. Prüfe, ob die Tabelle öffentlich lesbar ist.");
        }

        const csvRows = parseCSV(csvText.replace(/^\uFEFF/, ""));

        if (csvRows.length < 2) {
            throw new Error("Die Tabelle ist leer oder enthält keine Datenzeilen.");
        }

        const headers = csvRows[0];
        const nameIndex = findColumn(headers, ["name", "personenname"], 0);
        const graveIndex = findColumn(headers, ["grabnummer", "grabnr", "grab"], 1);
        const fileIndex = findColumn(headers, ["aktennummer", "aktennr", "akte"], 2);
        const reservedIndex = findColumn(headers, ["reserviert", "reservierung", "reservation"], 3);

        occupancyRows = csvRows.slice(1)
            .map(row => [
                row[nameIndex] ?? "",
                row[graveIndex] ?? "",
                row[fileIndex] ?? "",
                row[reservedIndex] ?? ""
            ])
            .filter(row => row.some(value => String(value).trim() !== ""));

        renderTable();
    } catch (error) {
        console.error("Belegungsdaten konnten nicht geladen werden:", error);
        tableBody.replaceChildren();

        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.className = "placeholder";
        td.textContent = "Belegungsdaten konnten nicht geladen werden.";
        tr.appendChild(td);
        tableBody.appendChild(tr);

        setStatus(
            "Daten nicht verfügbar. Google-Tabelle auf öffentliche Lesbarkeit prüfen. Details stehen in der Browser-Konsole.",
            true
        );
    }
}


searchInput.addEventListener("input", renderTable);
loadOccupancyData();
