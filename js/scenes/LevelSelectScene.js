export default class LevelSelectScene extends Phaser.Scene {
    constructor() {
        super('LevelSelectScene');
        this.selectedTables = new Set([3]); // Default to 3 times table selected
        this.tableButtons = {}; // To store references to button text objects
    }

    preload() {
        // Preload assets if needed, for now reuse existing ones
        console.log('LevelSelectScene: preload');
        // Load the specific background for this scene
        this.load.image('settingsBackground', 'assets/backgrounds/background_settings.png');
    }

    create() {
        console.log('LevelSelectScene: create');

        // --- Background ---
        // Use the specific background loaded in preload
        this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'settingsBackground')
            .setOrigin(0.5);

        // --- Title ---
        this.add.text(this.cameras.main.width / 2, 80, 'Select Times Tables', {
            fontSize: '48px', fill: '#ffffff', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 6,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 4, fill: true }
        }).setOrigin(0.5);

        // --- Music --- (Optional: Reuse start music or add specific)
        if (!this.sound.get('startMusic')?.isPlaying) {
            this.sound.play('startMusic', { loop: true, volume: 0.5 });
        }

        // --- Times Table Selection Buttons ---
        const buttonStyle = {
            fontSize: '32px', fill: '#ffffff', fontStyle: 'bold',
            backgroundColor: '#4a4a4a', // Dark grey background
            padding: { x: 15, y: 10 },
            stroke: '#000000', strokeThickness: 2,
            shadow: { offsetX: 1, offsetY: 1, color: '#000', blur: 2, fill: true }
        };
        const selectedStyle = { ...buttonStyle, backgroundColor: '#008000' }; // Green background when selected
        const hoverStyle = { fill: '#FFD700' }; // Gold text on hover

        const columns = 5;
        const rows = 2;
        const buttonWidth = 100;
        const buttonHeight = 60; // Approximate based on style padding
        const startX = (this.cameras.main.width - (columns * buttonWidth + (columns - 1) * 20)) / 2 + buttonWidth / 2;
        const startY = 180;
        const spacingX = buttonWidth + 20;
        const spacingY = buttonHeight + 20;

        for (let i = 1; i <= 10; i++) {
            const col = (i - 1) % columns;
            const row = Math.floor((i - 1) / columns);
            const x = startX + col * spacingX;
            const y = startY + row * spacingY;

            const buttonText = this.add.text(x, y, `${i}s`, buttonStyle)
                .setOrigin(0.5)
                .setInteractive();

            this.tableButtons[i] = buttonText; // Store reference

            // Set initial appearance based on default selection
            if (this.selectedTables.has(i)) {
                buttonText.setStyle(selectedStyle);
            }

            // Toggle selection on click
            buttonText.on('pointerdown', () => {
                if (this.selectedTables.has(i)) {
                    this.selectedTables.delete(i);
                    buttonText.setStyle(buttonStyle); // Deselected style
                } else {
                    this.selectedTables.add(i);
                    buttonText.setStyle(selectedStyle); // Selected style
                }
                this.updateStartButtonState(); // Enable/disable start button
                console.log('Selected tables:', Array.from(this.selectedTables));
            });

            // Hover effect
            buttonText.on('pointerover', () => {
                buttonText.setStyle({ ...buttonText.style.toJSON(), ...hoverStyle }); // Keep background, change text fill
            });
            buttonText.on('pointerout', () => {
                 // Reset to selected or deselected style based on current state
                if (this.selectedTables.has(i)) {
                    buttonText.setStyle(selectedStyle);
                } else {
                    buttonText.setStyle(buttonStyle);
                }
            });
        }

        // --- Start Game Button ---
        this.startButton = this.add.text(this.cameras.main.width / 2, this.cameras.main.height - 100, 'Start Game', {
            fontSize: '40px', fill: '#ffffff', fontStyle: 'bold',
            backgroundColor: '#8B4513', // Brown background
            padding: { x: 25, y: 15 },
            stroke: '#000000', strokeThickness: 2,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 4, fill: true }
        }).setOrigin(0.5).setInteractive();

        // Hover effect for Start Button
        this.startButton.on('pointerover', () => {
            if (this.startButton.alpha === 1) { // Only change if enabled
                 this.startButton.setStyle({ fill: '#FFD700' }); // Gold on hover
            }
        });
        this.startButton.on('pointerout', () => {
             this.startButton.setStyle({ fill: '#ffffff' }); // Back to white
        });

        // Click action for Start Button
        this.startButton.on('pointerdown', () => {
            if (this.selectedTables.size > 0) {
                console.log('Starting GameScene with tables:', Array.from(this.selectedTables));
                this.cameras.main.fadeOut(500, 0, 0, 0, (camera, progress) => {
                    if (progress === 1) {
                        this.sound.stopAll(); // Stop menu music
                        // Pass the selected tables as an array to the GameScene
                        this.scene.start('GameScene', { selectedTables: Array.from(this.selectedTables) });
                    }
                });
            } else {
                console.log('No tables selected.');
                // Optional: Add visual feedback like shaking the button or showing a message
            }
        });

        // --- Info Text ---
        this.infoText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height - 40, 'Select at least one table', {
            fontSize: '20px', fill: '#ffdddd', fontStyle: 'italic'
        }).setOrigin(0.5).setVisible(false); // Initially hidden

        // Initial state update for the start button
        this.updateStartButtonState();
    }

    updateStartButtonState() {
        if (this.selectedTables.size > 0) {
            this.startButton.setAlpha(1); // Enabled
            this.startButton.setInteractive(); // Ensure it's interactive
             this.infoText.setVisible(false); // Hide info text
        } else {
            this.startButton.setAlpha(0.5); // Disabled (visually dimmed)
            // Consider this.startButton.disableInteractive() if needed, but alpha might be enough
             this.infoText.setVisible(true); // Show info text
        }
    }
}
