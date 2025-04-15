// --- Konstanten ---
const TOTAL_LEVELS = 10;
const LOCAL_STORAGE_KEY = "hogwarts-math-progress";
const MULTIPLIER = 3; // Wir üben die 3er-Reihe

// --- DOM-Elemente ---
const progressIndicator = document.getElementById('progress-indicator');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const feedbackText = document.getElementById('feedback-text');
const scoreDisplay = document.getElementById('score');
const wrongAnswersDisplay = document.getElementById('wrong-answers');
const resetButton = document.getElementById('reset-button');

// --- Spielzustand ---
let gameData = {
    currentLevel: 1,
    score: 0,
    wrongAnswers: 0,
    completed: false,
    currentQuestion: null // { question: "3 × ?", correctAnswer: ?, options: [] }
};

// --- Funktionen ---

/**
 * Lädt den Spielstand aus dem localStorage.
 */
function loadGame() {
    const savedData = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedData) {
        gameData = JSON.parse(savedData);
        console.log("Spielstand geladen:", gameData);
    } else {
        console.log("Kein Spielstand gefunden, starte neues Spiel.");
        // Stelle sicher, dass ein neues Spiel initialisiert wird, falls kein Speicherstand da ist
        generateQuestion();
    }
    updateUI();
}

/**
 * Speichert den aktuellen Spielstand im localStorage.
 */
function saveGame() {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(gameData));
    console.log("Spielstand gespeichert:", gameData);
}

/**
 * Generiert eine neue Frage für das aktuelle Level.
 */
function generateQuestion() {
    if (gameData.completed) return; // Spiel ist schon durch

    const factor = gameData.currentLevel; // Oder eine zufällige Zahl bis 10? Vorerst Level = Faktor
    const correctAnswer = MULTIPLIER * factor;
    const question = `${MULTIPLIER} × ${factor}`;

    // Generiere falsche Antwortoptionen
    const options = generateOptions(correctAnswer);

    gameData.currentQuestion = { question, correctAnswer, options };
    console.log("Neue Frage generiert:", gameData.currentQuestion);
}

/**
 * Generiert drei Antwortoptionen, eine davon ist korrekt.
 * @param {number} correctAnswer - Die korrekte Antwort.
 * @returns {number[]} - Ein Array mit drei Optionen, gemischt.
 */
function generateOptions(correctAnswer) {
    const options = new Set([correctAnswer]); // Set verhindert Duplikate
    while (options.size < 3) {
        // Generiere falsche Antworten in der Nähe der richtigen Antwort
        const offset = Math.floor(Math.random() * 5) + 1; // +/- 1 bis 5
        const wrongAnswer = Math.random() < 0.5
            ? correctAnswer + offset
            : Math.max(0, correctAnswer - offset); // Stelle sicher, dass die Antwort nicht negativ ist

        if (wrongAnswer !== correctAnswer) {
            options.add(wrongAnswer);
        }
    }
    // Mische die Optionen
    return Array.from(options).sort(() => Math.random() - 0.5);
}


/**
 * Aktualisiert die Anzeige im HTML basierend auf gameData.
 */
function updateUI() {
    progressIndicator.textContent = `Raum ${gameData.currentLevel} von ${TOTAL_LEVELS}`;
    scoreDisplay.textContent = gameData.score;
    wrongAnswersDisplay.textContent = gameData.wrongAnswers;

    if (gameData.completed) {
        questionText.textContent = "🎉 Glückwunsch! Du hast alle Räume gemeistert! 🎉";
        optionsContainer.innerHTML = ''; // Keine Optionen mehr anzeigen
        feedbackText.textContent = `Dein finaler Punktestand: ${gameData.score}`;
        return;
    }

    if (gameData.currentQuestion) {
        questionText.textContent = gameData.currentQuestion.question;
        optionsContainer.innerHTML = ''; // Alte Optionen löschen
        gameData.currentQuestion.options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option;
            button.onclick = () => handleAnswer(option);
            optionsContainer.appendChild(button);
        });
    } else {
         // Initialzustand oder nach Reset, bevor die erste Frage generiert wurde
         questionText.textContent = "Bereit für die erste Aufgabe?";
         optionsContainer.innerHTML = '<button id="start-button">Start!</button>';
         document.getElementById('start-button').onclick = startGame;
    }

    // Feedback leeren, wenn eine neue Frage angezeigt wird
    if (!feedbackText.textContent.includes("Falsch")) { // Nur leeren, wenn nicht gerade eine falsche Antwort angezeigt wird
         feedbackText.textContent = '';
    }
}


/**
 * Verarbeitet die vom Benutzer ausgewählte Antwort.
 * @param {number} selectedOption - Die ausgewählte Antwort.
 */
function handleAnswer(selectedOption) {
    if (gameData.completed || !gameData.currentQuestion) return;

    const isCorrect = selectedOption === gameData.currentQuestion.correctAnswer;

    if (isCorrect) {
        feedbackText.textContent = "Richtig! ✨";
        feedbackText.style.color = 'green';
        gameData.score++;
        // Kurze Pause, bevor das nächste Level geladen wird
        setTimeout(() => {
            advanceLevel();
            feedbackText.textContent = ''; // Feedback zurücksetzen
        }, 1000); // 1 Sekunde warten
    } else {
        feedbackText.textContent = `Falsch. Die richtige Antwort für ${gameData.currentQuestion.question} ist ${gameData.currentQuestion.correctAnswer}. Versuch es nochmal!`;
        feedbackText.style.color = 'red';
        gameData.wrongAnswers++;
        // Frage bleibt für Wiederholung, UI wird aktualisiert (Score/Fehler)
        updateUI(); // Nur Score/Fehler aktualisieren
        saveGame(); // Spielstand speichern (Fehlerzahl erhöht)
    }
}

/**
 * Geht zum nächsten Level über oder beendet das Spiel.
 */
function advanceLevel() {
    if (gameData.currentLevel < TOTAL_LEVELS) {
        gameData.currentLevel++;
        generateQuestion();
    } else {
        gameData.completed = true;
        console.log("Spiel abgeschlossen!");
    }
    updateUI();
    saveGame();
}

/**
 * Setzt das Spiel auf den Anfangszustand zurück.
 */
function resetGame() {
    console.log("Setze Spiel zurück.");
    gameData = {
        currentLevel: 1,
        score: 0,
        wrongAnswers: 0,
        completed: false,
        currentQuestion: null
    };
    localStorage.removeItem(LOCAL_STORAGE_KEY); // Gespeicherten Spielstand löschen
    generateQuestion(); // Erste Frage generieren
    updateUI();
    saveGame(); // Initialen Zustand speichern (optional, aber konsistent)
}

/**
* Startet das Spiel (wird vom Start-Button aufgerufen)
*/
function startGame() {
    if (!gameData.currentQuestion) { // Nur starten, wenn noch keine Frage da ist
        generateQuestion();
    }
    updateUI();
}


// --- Event Listener ---
resetButton.addEventListener('click', resetGame);

// --- Initialisierung ---
document.addEventListener('DOMContentLoaded', () => {
    loadGame(); // Lade Spielstand, wenn die Seite geladen ist
    if (!gameData.currentQuestion && !gameData.completed) {
         // Wenn kein Spielstand geladen wurde ODER das Spiel noch nicht begonnen hat, zeige Start-Screen
         updateUI(); // Zeigt den "Bereit?" Text und Start-Button
    } else {
         // Wenn ein Spielstand geladen wurde (mit einer Frage oder abgeschlossen), zeige diesen Zustand
         updateUI();
    }
});
