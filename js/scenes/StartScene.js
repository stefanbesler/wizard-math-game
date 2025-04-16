export default class StartScene extends Phaser.Scene {
    constructor() {
        super('StartScene');
    }

    create() {
        console.log('StartScene: create');

        // Display the title screen image, centered
        this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'titleScreen')
            .setOrigin(0.5); // Center the image based on its middle point

        // --- Music ---
        // Start background music if not already playing
        if (!this.sound.get('startMusic')?.isPlaying) {
            this.sound.play('startMusic', { loop: true, volume: 0.6 });
        }

        // --- Interaction ---
        // Make the entire screen clickable to start the game
        this.input.on('pointerdown', () => {
            console.log('Starting GameScene...');
            // Optional: Add a fade out effect
            this.cameras.main.fadeOut(500, 0, 0, 0, (camera, progress) => {
                if (progress === 1) {
                    this.sound.stopAll(); // Stop menu music
                    this.scene.start('GameScene');
                }
            });
        });

        // --- Alternative: Text Button ---
        // If your title screen image doesn't have a button, you could add one like this:
        /*
        const startButton = this.add.text(this.cameras.main.width / 2, 480, 'Start Game', {
            fontSize: '40px',
            fill: '#ffffff', // White text
            fontStyle: 'bold',
            backgroundColor: '#8B4513', // Brown background like the image button
            padding: { x: 25, y: 15 },
            stroke: '#000000',
            strokeThickness: 2,
            shadow: { offsetX: 2, offsetY: 2, color: '#000', blur: 4, fill: true }
        }).setOrigin(0.5).setInteractive(); // Make it clickable

        // Hover effect
        startButton.on('pointerover', () => startButton.setStyle({ fill: '#FFD700' })); // Gold on hover
        startButton.on('pointerout', () => startButton.setStyle({ fill: '#ffffff' })); // Back to white

        // Click action
        startButton.on('pointerdown', () => {
            console.log('Starting GameScene...');
            this.cameras.main.fadeOut(500, 0, 0, 0, (camera, progress) => {
                 if (progress === 1) {
                    this.scene.start('GameScene');
                 }
            });
        });
        */
    }
}
