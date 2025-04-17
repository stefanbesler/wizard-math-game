export default class StatisticsScene extends Phaser.Scene {
    constructor() {
        super('StatisticsScene');
        this.sessionStats = [];
        this.selectedTables = [];
        this.difficultyScores = {}; // Store scores as { '1x1': score, '1x2': score, ... }
        this.maxScore = -Infinity; // For normalization
        this.minScore = Infinity;  // For normalization
    }

    init(data) {
        console.log('StatisticsScene init, received data:', data);
        this.sessionStats = data.sessionStats || [];
        // Ensure selectedTables is always an array, even if not passed correctly
        this.selectedTables = Array.isArray(data.selectedTables) ? data.selectedTables : [];
        this.difficultyScores = {}; // Reset scores each time scene is entered
        this.maxScore = -Infinity;
        this.minScore = Infinity;
    }

    preload() {
        console.log('StatisticsScene: preload');
        // Assuming 'settingsBackground' was loaded in BootScene or LevelSelectScene
        // If not, uncomment the line below:
        // this.load.image('settingsBackground', 'assets/backgrounds/background_settings.png');
    }

    create() {
        console.log('StatisticsScene: create');

        // --- Background ---
        this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'settingsBackground')
            .setOrigin(0.5);

        // --- Title ---
        this.add.text(this.cameras.main.width / 2, 40, 'Session Statistics', {
            fontSize: '38px', fill: '#fff', fontStyle: 'bold', stroke: '#000', strokeThickness: 5
        }).setOrigin(0.5);

        // --- Calculate Difficulty Scores ---
        this.calculateScores();

        // --- Display Grid ---
        this.displayGrid();

        // --- Display Legend ---
        this.displayLegend();

        // --- Navigation Buttons ---
        this.displayButtons();

        // Fade in
        this.cameras.main.fadeIn(300, 0, 0, 0);
    }

    calculateScores() {
        // Initialize scores for all 1x1 to 10x10 facts
        for (let i = 1; i <= 10; i++) {
            for (let j = 1; j <= 10; j++) {
                const key = `${i}x${j}`;
                this.difficultyScores[key] = { score: 0, attempts: 0, correct: 0, totalTime: 0 };
            }
        }

        // Process session stats
        this.sessionStats.forEach(stat => {
            // Ensure numbers are within 1-10 range for the grid
            if (stat.num1 >= 1 && stat.num1 <= 10 && stat.num2 >= 1 && stat.num2 <= 10) {
                const key = `${stat.num1}x${stat.num2}`;
                const entry = this.difficultyScores[key];

                entry.attempts++;
                entry.totalTime += stat.timeTaken;

                if (stat.correct) {
                    entry.correct++;
                    // Decrease score for correct answers, more decrease for faster answers
                    // Base decrease + bonus for speed (lower time = higher bonus)
                    // Avoid division by zero; use Math.max with a minimum time (e.g., 100ms)
                    const timeFactor = 5000 / Math.max(stat.timeTaken, 100); // Adjust 5000 as needed
                    entry.score -= (1 + timeFactor); // Base decrease of 1 + time bonus
                } else {
                    // Increase score significantly for wrong answers
                    entry.score += 10; // Adjust penalty as needed
                }
            }
        });

        // Normalize scores (find min/max of the calculated scores)
        let hasScores = false;
        for (const key in this.difficultyScores) {
            const score = this.difficultyScores[key].score;
             // Only consider facts that were actually attempted for min/max normalization
            if (this.difficultyScores[key].attempts > 0) {
                this.minScore = Math.min(this.minScore, score);
                this.maxScore = Math.max(this.maxScore, score);
                hasScores = true;
            }
        }

         // Handle cases where no stats were recorded or all scores are the same
        if (!hasScores || this.minScore === this.maxScore) {
             this.minScore = 0; // Avoid division by zero later
             this.maxScore = 1; // Provide a default range
             if (hasScores && this.difficultyScores[Object.keys(this.difficultyScores)[0]].score === 0) {
                 // If all attempted scores are 0, set max slightly higher to avoid 0/0
                 this.maxScore = 1;
             } else if (hasScores) {
                 // If all scores are the same non-zero value, adjust min/max for differentiation
                 this.minScore = this.maxScore - 1;
             }
        }


        console.log("Difficulty Scores Calculated:", this.difficultyScores);
        console.log("Score Range (Min/Max):", this.minScore, this.maxScore);
    }

    displayGrid() {
        const gridSize = 10;
        const cellSize = 45; // Size of each cell in the grid
        const startX = (this.cameras.main.width - (gridSize + 1) * cellSize) / 2; // Center the grid horizontally
        const startY = 100; // Vertical start position
        const headerFontSize = '16px';
        const cellFontSize = '14px';

        // --- Headers ---
        // Top headers (1-10)
        for (let j = 1; j <= gridSize; j++) {
            this.add.text(startX + (j + 0.5) * cellSize, startY + 0.5 * cellSize, j.toString(), {
                fontSize: headerFontSize, fill: '#fff', fontStyle: 'bold'
            }).setOrigin(0.5);
        }
        // Left headers (1-10)
        for (let i = 1; i <= gridSize; i++) {
            this.add.text(startX + 0.5 * cellSize, startY + (i + 0.5) * cellSize, i.toString(), {
                fontSize: headerFontSize, fill: '#fff', fontStyle: 'bold'
            }).setOrigin(0.5);
        }

        // --- Grid Cells ---
        for (let i = 1; i <= gridSize; i++) { // Row (num1)
            for (let j = 1; j <= gridSize; j++) { // Column (num2)
                const key = `${i}x${j}`;
                const scoreData = this.difficultyScores[key];
                const cellX = startX + (j + 0.5) * cellSize;
                const cellY = startY + (i + 0.5) * cellSize;

                // Calculate normalized score (0 to 1) for color interpolation
                // Handle cases where a fact wasn't attempted
                let normalizedScore = 0.5; // Default to neutral if not attempted
                let attempts = 0;
                if (scoreData && scoreData.attempts > 0) {
                    attempts = scoreData.attempts;
                    const scoreRange = this.maxScore - this.minScore;
                     // Clamp score within the calculated range before normalizing
                    const clampedScore = Math.max(this.minScore, Math.min(scoreData.score, this.maxScore));
                    normalizedScore = (scoreRange > 0) ? (clampedScore - this.minScore) / scoreRange : 0.5; // Avoid division by zero
                }

                // Interpolate color: 0 (easy) = green, 0.5 (neutral) = yellow, 1 (hard) = red
                const easyColor = Phaser.Display.Color.ValueToColor(0x00ff00); // Green
                const midColor = Phaser.Display.Color.ValueToColor(0xffff00); // Yellow
                const hardColor = Phaser.Display.Color.ValueToColor(0xff0000); // Red
                let cellColor;
                if (normalizedScore < 0.5) {
                    // Interpolate between green and yellow
                    cellColor = Phaser.Display.Color.Interpolate.ColorWithColor(easyColor, midColor, 1, normalizedScore * 2);
                } else {
                    // Interpolate between yellow and red
                    cellColor = Phaser.Display.Color.Interpolate.ColorWithColor(midColor, hardColor, 1, (normalizedScore - 0.5) * 2);
                }

                // Add cell background rectangle
                const rect = this.add.rectangle(cellX, cellY, cellSize - 2, cellSize - 2, cellColor.color)
                    .setStrokeStyle(1, 0xffffff); // White border

                // Add product text inside the cell
                const productText = this.add.text(cellX, cellY, (i * j).toString(), {
                    fontSize: cellFontSize, fill: '#000', fontStyle: 'bold' // Black text for contrast
                }).setOrigin(0.5);

                 // Add tooltip on hover (optional but helpful)
                 if (attempts > 0) {
                    const avgTime = (scoreData.totalTime / attempts / 1000).toFixed(1); // Avg time in seconds
                    const accuracy = ((scoreData.correct / attempts) * 100).toFixed(0);
                    const tooltipText = `${i} x ${j}\nAttempts: ${attempts}\nCorrect: ${scoreData.correct} (${accuracy}%)\nAvg Time: ${avgTime}s\nScore: ${scoreData.score.toFixed(1)}`;
                    // Simple hover effect: change border and show tooltip text (could use a dedicated tooltip object)
                    rect.setInteractive();
                    rect.on('pointerover', () => {
                        rect.setStrokeStyle(2, 0x000000); // Black border on hover
                        // Ideally, show a proper tooltip text object here
                    });
                     rect.on('pointerout', () => {
                         rect.setStrokeStyle(1, 0xffffff); // Back to white border
                         // Hide tooltip text object
                     });
                 } else {
                     // Slightly dim cells that were not attempted
                     rect.setAlpha(0.6);
                     productText.setAlpha(0.6);
                 }
            }
        }
    }

    displayLegend() {
        const legendX = this.cameras.main.width * 0.15; // Position legend on the left
        const legendY = this.cameras.main.height - 80; // Position near the bottom
        const legendWidth = 200;
        const legendHeight = 20;

        // Create a graphics object for the gradient bar
        const graphics = this.add.graphics();

        // Draw the gradient bar (Green -> Yellow -> Red)
        const easyColor = 0x00ff00;
        const midColor = 0xffff00;
        const hardColor = 0xff0000;

        // Draw left half (Green to Yellow)
        graphics.fillGradientStyle(easyColor, easyColor, midColor, midColor, 1);
        graphics.fillRect(legendX, legendY, legendWidth / 2, legendHeight);

        // Draw right half (Yellow to Red)
        graphics.fillGradientStyle(midColor, midColor, hardColor, hardColor, 1);
        graphics.fillRect(legendX + legendWidth / 2, legendY, legendWidth / 2, legendHeight);

        // Add labels
        this.add.text(legendX, legendY + legendHeight + 5, 'Easier / Faster', { fontSize: '14px', fill: '#fff' }).setOrigin(0, 0);
        this.add.text(legendX + legendWidth, legendY + legendHeight + 5, 'Harder / Slower', { fontSize: '14px', fill: '#fff' }).setOrigin(1, 0);
        this.add.text(legendX + legendWidth / 2, legendY - 5, 'Difficulty', { fontSize: '16px', fill: '#fff', fontStyle: 'bold' }).setOrigin(0.5, 1);
    }


    displayButtons() {
        const buttonY = this.cameras.main.height - 40; // Position buttons at the very bottom

        // Back to Menu Button
        const menuButton = this.add.text(this.cameras.main.width * 0.7, buttonY, 'Back to Menu', {
            fontSize: '24px', fill: '#FFF', backgroundColor: '#555', padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive();

        menuButton.on('pointerdown', () => {
            this.sound.stopAll(); // Stop any sounds if needed
            this.scene.start('StartScene'); // Go back to the main menu
        });
        menuButton.on('pointerover', () => menuButton.setStyle({ fill: '#FF0' }));
        menuButton.on('pointerout', () => menuButton.setStyle({ fill: '#FFF' }));

        // Play Again Button (using the same selected tables)
        const againButton = this.add.text(this.cameras.main.width * 0.9, buttonY, 'Play Again', {
            fontSize: '24px', fill: '#FFF', backgroundColor: '#555', padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive();

        againButton.on('pointerdown', () => {
            this.sound.stopAll();
            // Pass the original selected tables back to GameScene
            this.scene.start('GameScene', { selectedTables: this.selectedTables });
        });
        againButton.on('pointerover', () => againButton.setStyle({ fill: '#FF0' }));
        againButton.on('pointerout', () => againButton.setStyle({ fill: '#FFF' }));
    }

}
