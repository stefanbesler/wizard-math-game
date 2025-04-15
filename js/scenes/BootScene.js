export default class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene'); // Scene key
    }

    preload() {
        console.log('BootScene: preload');

        // Show a loading message
        const width = this.cameras.main.width;
        const height = this.cameras.main.height;
        const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
            fontSize: '32px', fill: '#fff', fontStyle: 'bold'
        }).setOrigin(0.5);

        // --- Load Assets ---

        // Backgrounds
        this.load.image('titleScreen', 'assets/backgrounds/title_screen.png');
        // Make sure you have a placeholder image at this path
        this.load.image('gameBackground', 'assets/backgrounds/placeholder_background.png');

        // Spritesheets (Ensure paths and frame dimensions are correct)
        this.load.spritesheet('wizard', 'assets/sprites/wizard_spritesheet.png', {
            frameWidth: 56, // Corrected width
            frameHeight: 64
        });
        this.load.spritesheet('enemies', 'assets/sprites/enemies_spritesheet.png', {
            frameWidth: 60, // Corrected width
            frameHeight: 64
        });

        // Placeholder for Sounds (Uncomment and add paths when you have sound files)
        // this.load.audio('correctSound', 'assets/sounds/correct.wav');
        // this.load.audio('castSound', 'assets/sounds/cast.wav');
        // this.load.audio('enemyHitSound', 'assets/sounds/hit.wav');
        // this.load.audio('gameOverSound', 'assets/sounds/gameover.wav');
        // this.load.audio('backgroundMusic', 'assets/sounds/music.mp3');


        // --- Loading Progress --- (Optional but nice)
        const progressBar = this.add.graphics();
        const progressBox = this.add.graphics();
        progressBox.fillStyle(0x222222, 0.8);
        progressBox.fillRect(width / 2 - 160, height / 2 - 5, 320, 30);

        this.load.on('progress', (value) => {
            progressBar.clear();
            progressBar.fillStyle(0xffd700, 1); // Gold color for progress
            progressBar.fillRect(width / 2 - 150, height / 2, 300 * value, 20);
        });

        // --- Loading Complete ---
        this.load.on('complete', () => {
            console.log('Assets loaded');
            // Destroy loading visuals
            progressBar.destroy();
            progressBox.destroy();
            loadingText.destroy();

            // Create animations globally so they are available in other scenes
            this.createWizardAnimations();
            this.createEnemyAnimations();

            // Start the next scene
            this.scene.start('StartScene');
        });

        // --- Handle Loading Errors ---
        this.load.on('loaderror', (file) => {
           console.error(`Error loading asset: ${file.key} from ${file.url}`);
           // Display error message to user?
           loadingText.setText(`Error loading: ${file.key}`);
        });
    }

    createWizardAnimations() {
        // Based on wizard_spritesheet.png (3x2 grid)
        // Idle animation using frames 0-2 (top row)
        this.anims.create({
            key: 'wizard_idle',
            frames: this.anims.generateFrameNumbers('wizard', { start: 0, end: 2 }),
            frameRate: 4, // Adjust speed as needed
            repeat: -1    // Loop indefinitely
        });

        // Cast animation using frames 3-4 (bottom row, first two)
        this.anims.create({
            key: 'wizard_cast',
            frames: this.anims.generateFrameNumbers('wizard', { start: 3, end: 4 }),
            frameRate: 8, // Adjust speed as needed
            repeat: 0     // Play only once
        });
        // Frame 5 could be used for 'wizard_hurt' if needed later
    }

    createEnemyAnimations() {
        // Based on enemies_spritesheet.png (3x3 grid)

        // Shadow enemy animation (frames 0-2)
        this.anims.create({
            key: 'shadow_idle',
            frames: this.anims.generateFrameNumbers('enemies', { start: 0, end: 2 }),
            frameRate: 5, // Adjust speed as needed
            repeat: -1
        });

        // Ghost enemy animation (frames 3-5)
        this.anims.create({
            key: 'ghost_idle',
            frames: this.anims.generateFrameNumbers('enemies', { start: 3, end: 5 }),
            frameRate: 4, // Adjust speed as needed
            repeat: -1
        });

        // Plant enemy animation (frames 6-8)
        this.anims.create({
            key: 'plant_idle',
            frames: this.anims.generateFrameNumbers('enemies', { start: 6, end: 8 }),
            frameRate: 3, // Adjust speed as needed
            repeat: -1
        });
    }
}
