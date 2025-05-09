export default class StatisticsScene extends Phaser.Scene {
    constructor() {
        super('StatisticsScene');
        this.sessionStats = [];
        this.selectedTables = [];
        // Store stats as { '1x1': { attempts: 0, errors: 0, totalTime: 0, category: 'none' }, ... }
        this.factStats = {};
        this.FAST_THRESHOLD_MS = 3500; // Time in ms to qualify as 'fast' (adjust as needed)
    }

    init(data) {
        console.log('StatisticsScene init, received data:', data);
        this.sessionStats = data.sessionStats || [];
        // Ensure selectedTables is always an array, even if not passed correctly
        this.selectedTables = Array.isArray(data.selectedTables) ? data.selectedTables : [];
        this.factStats = {}; // Reset stats each time scene is entered
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

        // --- Navigation Buttons ---
        this.displayButtons();

        // Fade in
        this.cameras.main.fadeIn(300, 0, 0, 0);
    }

    calculateScores() {
        // Initialize stats for all 1x1 to 10x10 facts
        for (let i = 1; i <= 10; i++) {
            for (let j = 1; j <= 10; j++) {
                const key = `${i}x${j}`;
                // Initialize with category 'none'
                this.factStats[key] = { attempts: 0, errors: 0, totalTimeCorrect: 0, correctCount: 0, category: 'none' };
            }
        }

        // Process session stats
        this.sessionStats.forEach(stat => {
            // Ensure numbers are within 1-10 range for the grid
            if (stat.num1 >= 1 && stat.num1 <= 10 && stat.num2 >= 1 && stat.num2 <= 10) {
                const key = `${stat.num1}x${stat.num2}`;
                const entry = this.factStats[key];

                entry.attempts++;
                if (stat.correct) {
                    entry.correctCount++;
                    entry.totalTimeCorrect += stat.timeTaken;
                } else {
                    entry.errors++;
                }
            }
        });

        // Determine category for each fact
        for (const key in this.factStats) {
            const entry = this.factStats[key];
            if (entry.attempts > 0) {
                if (entry.errors > 0) {
                    entry.category = 'incorrect'; // Any error makes it red
                } else {
                    // No errors, check time
                    const averageTime = entry.totalTimeCorrect / entry.correctCount;
                    if (averageTime <= this.FAST_THRESHOLD_MS) {
                        entry.category = 'fast'; // Correct and fast enough
                    } else {
                        entry.category = 'slow'; // Correct but too slow
                    }
                }
            } else {
                entry.category = 'none'; // No attempts
            }
        }

        console.log("Fact Statistics Calculated:", this.factStats);
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
                const stats = this.factStats[key];
                const cellX = startX + (j + 0.5) * cellSize;
                const cellY = startY + (i + 0.5) * cellSize;

                let cellColor;
                let textColor = '#ffffff'; // Default white text
                let alpha = 1.0;

                // Determine background color based on category
                switch (stats.category) {
                    case 'fast':
                        cellColor = 0x00cc44; // Green
                        break;
                    case 'slow':
                        cellColor = 0xffa500; // Orange
                        break;
                    case 'incorrect':
                        cellColor = 0xcc4444; // Red
                        break;
                    case 'none':
                    default:
                        cellColor = 0x555555; // Dark Grey
                        textColor = '#aaaaaa'; // Lighter grey text for unused cells
                        alpha = 0.7; // Slightly dim unused cells
                        break;
                }

                // Add cell background rectangle
                const rect = this.add.rectangle(cellX, cellY, cellSize - 2, cellSize - 2, cellColor)
                    .setStrokeStyle(1, 0xaaaaaa) // Light grey border for all cells
                    .setAlpha(alpha);

                // Add product text inside the cell
                const productText = this.add.text(cellX, cellY, (i * j).toString(), {
                    fontSize: cellFontSize, fill: textColor, fontStyle: 'bold'
                }).setOrigin(0.5).setAlpha(alpha);

                // No tooltip or hover effects needed in this simplified version
            }
        }
    }

    // displayLegend() function is removed

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
