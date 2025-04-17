export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');

        // Game state variables
        this.wizard = null;
        this.enemies = null; // Physics group for enemies
        this.projectiles = null; // Physics group for spells (if needed later)
        this.particles = null; // Particle emitter manager

        // UI Elements
        this.questionText = null;
        this.inputText = null;
        this.scoreText = null;

        // Gameplay Variables
        this.currentInput = '';
        this.currentQuestion = { num1: 0, num2: 0, answer: 0 };
        this.score = 0;
        // Wave spawning variables
        this.waveNumber = 0;
        this.enemiesPerWave = 2; // Start with 2 enemies
        this.enemiesSpawnedThisWave = 0;
        this.timeBetweenWaves = 8000; // Initial time between waves (ms)
        this.minTimeBetweenWaves = 3000; // Minimum time between waves
        this.timeBetweenEnemiesInWave = 1000; // Time between individual enemy spawns within a wave (ms)
        this.waveSpawnTimer = null; // Timer for spawning enemies within a wave
        this.nextWaveTimer = null; // Timer for scheduling the next wave

        this.enemySpeed = 45; // Base pixels per second, might increase later
        this.gameOverLineX = 150; // X-coordinate where enemies trigger game over
        this.isGameOver = false;
        this.selectedTables = [3]; // Default value, will be overwritten by init
    }

    // Initialize scene with data passed from the previous scene
    init(data) {
        console.log('GameScene init, received data:', data);
        // Use selected tables if passed, otherwise keep the default [3]
        if (data && data.selectedTables && data.selectedTables.length > 0) {
            this.selectedTables = data.selectedTables;
        } else {
            console.warn('No valid selectedTables received, defaulting to [3]');
            this.selectedTables = [3]; // Fallback if no data is passed
        }
        console.log('GameScene will use tables:', this.selectedTables);
    }


    create() {
        console.log('GameScene: create');
        this.isGameOver = false; // Reset game over flag on scene start/restart

        // --- World Setup ---
        // Background
        this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'gameBackground').setOrigin(0.5);

        // Optional: Add a visual line for Game Over (debugging)
        // this.add.line(0, 0, this.gameOverLineX, 0, this.gameOverLineX, this.cameras.main.height, 0xff0000, 0.5).setOrigin(0);

        // --- Player Character ---
        // Place wizard on the left, bottom-aligned
        this.wizard = this.add.sprite(100, this.cameras.main.height - 80, 'wizard')
            .setOrigin(0.5, 1) // Origin bottom-center
            .setScale(2.5);    // Make wizard larger
        this.wizard.play('wizard_idle'); // Start idle animation

        // Return to idle after casting
        this.wizard.on('animationcomplete', (animation) => {
            if (animation.key === 'wizard_cast') {
                this.wizard.play('wizard_idle');
            }
        });

        // --- Enemies ---
        // Create a physics group for enemies to handle movement and collision
        this.enemies = this.physics.add.group();

        // --- Particles --- (Removing - will use tweens instead)
        // this.particles = this.add.particles('wizard');

        // --- UI Elements ---
        // Question Text (Top Center)
        this.questionText = this.add.text(this.cameras.main.width / 2, 50, '3 x ? = ?', {
            fontSize: '40px', fill: '#ffffff', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 5,
            align: 'center'
        }).setOrigin(0.5);

        // Input Text Display (Below Question)
        this.inputText = this.add.text(this.cameras.main.width / 2, 115, '_', {
            fontSize: '36px', fill: '#FFD700', // Gold color for input
            fontStyle: 'bold',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: { x: 15, y: 8 },
            align: 'center'
        }).setOrigin(0.5);

        // Score Text (Top Right)
        this.score = 0; // Reset score on create
        this.scoreText = this.add.text(this.cameras.main.width - 20, 20, 'Score: 0', {
             fontSize: '28px', fill: '#ffffff', fontStyle: 'bold',
             stroke: '#000000', strokeThickness: 4
        }).setOrigin(1, 0); // Align top-right

        // --- Input Handling ---
        this.input.keyboard.on('keydown', this.handleKeyInput, this);

        // --- Initial Game State ---
        this.generateQuestion();
        this.currentInput = '';
        this.updateInputText();

        // --- Start Enemy Wave Spawning ---
        // Start the first wave after an initial delay
        const initialSpawnDelay = 3000; // Time before the very first wave starts
        this.nextWaveTimer = this.time.delayedCall(initialSpawnDelay, this.startNextWave, [], this);
        console.log(`First wave scheduled in ${initialSpawnDelay / 1000}s`);

        // Fade in the scene
        this.cameras.main.fadeIn(500, 0, 0, 0);

         // Start background music for the game scene
         if (!this.sound.get('gameMusic')?.isPlaying) {
            this.sound.play('gameMusic', { loop: true, volume: 0.4 }); // Adjust volume as needed
         }
    }

    update(time, delta) {
        // Skip update logic if game is over
        if (this.isGameOver) {
            return;
        }

        // --- Enemy Movement and Checks ---
        // Use Phaser's group iteration
        this.enemies.children.iterate((enemy) => {
            if (enemy) { // Check if enemy exists (it might be destroyed)
                // Move enemy left based on speed and delta time
                enemy.x -= (this.enemySpeed / 1000) * delta;

                // Note: Animation should be playing automatically if started correctly in spawnEnemy

                // --- Game Over Check ---
                if (enemy.x < this.gameOverLineX) {
                    this.triggerGameOver(enemy);
                    return; // Stop checking other enemies once game is over
                }

                // Optional: Despawn enemies that go way off-screen left (if needed)
                // if (enemy.x < -100) {
                //     enemy.destroy();
                // }
            }
        });
    }

    handleKeyInput(event) {
        // Ignore input if game is over
        if (this.isGameOver) {
            return;
        }

        // Handle number input (0-9)
        if (event.key >= '0' && event.key <= '9') {
             // Limit input length (e.g., max 3 digits)
            if (this.currentInput.length < 3) {
                this.currentInput += event.key;
            }
        }
        // Handle Backspace
        else if (event.key === 'Backspace') {
            this.currentInput = this.currentInput.slice(0, -1); // Remove last character
        }
        // Handle Enter key to submit answer
        else if (event.key === 'Enter' && this.currentInput.length > 0) {
            this.checkAnswer();
            this.currentInput = ''; // Clear input field after submitting
        }

        // Update the displayed input text
        this.updateInputText();
    }

    updateInputText() {
        // Show underscore as placeholder if input is empty, otherwise show the input
        this.inputText.setText(this.currentInput || '_');
    }

    generateQuestion() {
        // Select the first number randomly from the player's chosen tables
        const num1 = Phaser.Math.RND.pick(this.selectedTables);
        const num2 = Phaser.Math.Between(1, 10); // Random number between 1 and 10 (or adjust range if needed)
        this.currentQuestion.num1 = num1;
        this.currentQuestion.num2 = num2;
        this.currentQuestion.answer = num1 * num2;

        // Display the question
        this.questionText.setText(`${num1} × ${num2} = ?`); // Use multiplication symbol

        // Log for debugging
        console.log(`New question: ${num1} x ${num2} = ${this.currentQuestion.answer} (Using tables: ${this.selectedTables.join(', ')})`);

        // Record start time for this question
        this.questionStartTime = Date.now();
    }

    checkAnswer() {
        // Convert the player's input string to a number
        const playerAnswer = parseInt(this.currentInput);

        // Check if the parsed number is valid and matches the correct answer
        if (!isNaN(playerAnswer) && playerAnswer === this.currentQuestion.answer) {
            this.handleCorrectAnswer();
        } else {
            this.handleWrongAnswer();
        }
    }

    handleCorrectAnswer() {
        console.log('Correct!');
        this.sound.play('correctSound'); // Play correct answer sound

        // Play wizard casting animation
        this.wizard.play('wizard_cast');

        // Increase score
        this.score += 10;
        this.scoreText.setText('Score: ' + this.score);

        // --- Find and Attack Closest Enemy ---
        let closestEnemy = this.physics.closest(this.wizard, this.enemies.getChildren());

        if (closestEnemy) {
            console.log('Defeating enemy at x:', closestEnemy.x);

            // Play cast sound
            this.sound.play('castSound');

            // Play enemy hit sound slightly delayed
            this.sound.play('enemyHitSound', { delay: 0.15 }); // Delay in seconds

            // --- Use Built-in Effects ---
            // 1. Camera Flash
            this.cameras.main.flash(150, 255, 255, 255); // duration, r, g, b (white flash)

            // 2. Enemy Tween (Scale up and Fade out)
            this.tweens.add({
                targets: closestEnemy,
                scaleX: closestEnemy.scaleX * 1.5, // Scale up slightly
                scaleY: closestEnemy.scaleY * 1.5,
                alpha: 0, // Fade out
                duration: 200, // milliseconds
                ease: 'Power2', // Phaser easing function
                onComplete: () => {
                    // Destroy the enemy *after* the tween finishes
                    if (closestEnemy.active) { // Check if it wasn't already destroyed somehow
                       closestEnemy.destroy();
                    }
                }
            });

            // Note: Enemy is destroyed by the tween's onComplete callback now

        } else {
            console.log('Correct answer, but no enemies to target.');
            // Still play cast animation even if no target? Your choice.
            // If not, move the wizard.play('wizard_cast') inside the if(closestEnemy) block.
        }

        // Generate the next question immediately
        this.generateQuestion();
    }

    handleWrongAnswer() {
        console.log('Wrong!');
        // Provide feedback to the player
        // Shake the camera slightly
        this.cameras.main.shake(150, 0.008); // duration, intensity

        // Flash the input text red
        this.inputText.setFill('#ff0000'); // Red
        this.time.delayedCall(300, () => {
            this.inputText.setFill('#FFD700'); // Back to gold
        });

        // Play a 'wrong' sound effect
        this.sound.play('wrongSound');

        // Do NOT generate a new question - let the player retry
        // Optional: Make enemies move slightly faster or closer? (Be careful with this, might be frustrating)
        // this.enemies.getChildren().forEach(enemy => {
        //     if (enemy) enemy.x -= 10; // Small nudge forward
        // });
    }

    // --- Wave Management ---

    startNextWave() {
        if (this.isGameOver) return;

        this.waveNumber++;
        this.enemiesSpawnedThisWave = 0;
        // Increase difficulty: more enemies per wave, less time between waves
        this.enemiesPerWave = 2 + Math.floor(this.waveNumber / 2); // Example: increases every 2 waves
        this.timeBetweenWaves = Math.max(this.minTimeBetweenWaves, 8000 - this.waveNumber * 150); // Decrease time between waves gradually

        console.log(`Starting Wave ${this.waveNumber}: Spawning ${this.enemiesPerWave} enemies. Next wave in ${this.timeBetweenWaves / 1000}s.`);

        // Start spawning enemies for the current wave
        this.waveSpawnTimer = this.time.addEvent({
            delay: this.timeBetweenEnemiesInWave,
            callback: this.spawnEnemyInWave,
            callbackScope: this,
            repeat: this.enemiesPerWave - 1 // Spawn first one immediately, then repeat N-1 times
        });
        // Spawn the first enemy of the wave immediately
        this.spawnEnemyInWave();
    }

    spawnEnemyInWave() {
        if (this.isGameOver) return;

        this.spawnEnemy(); // Call the actual enemy creation logic
        this.enemiesSpawnedThisWave++;

        // Check if wave is complete
        if (this.enemiesSpawnedThisWave >= this.enemiesPerWave) {
            console.log(`Wave ${this.waveNumber} spawning complete.`);
            // Schedule the next wave
            if (this.waveSpawnTimer) this.waveSpawnTimer.remove(false); // Ensure current timer is stopped
            this.nextWaveTimer = this.time.delayedCall(this.timeBetweenWaves, this.startNextWave, [], this);
        }
    }

    // --- Individual Enemy Spawning ---

    spawnEnemy() {
        // This function now just creates a single enemy instance

        // Calculate spawn position: off-screen right, vertically aligned with wizard's base
        const yPos = this.cameras.main.height - 80; // Match wizard Y pos (adjust slightly if needed)
        const startX = this.cameras.main.width + Phaser.Math.Between(50, 100); // Start slightly varied off-screen right

        // Choose a random enemy type (0: shadow, 1: ghost, 2: plant)
        const enemyType = Phaser.Math.Between(0, 2);
        const enemyTypes = [
            { frame: 0, anim: 'shadow_idle', name: 'Shadow' },
            { frame: 3, anim: 'ghost_idle', name: 'Ghost' },
            { frame: 6, anim: 'plant_idle', name: 'Plant' }
        ];
        const selectedEnemy = enemyTypes[enemyType];

        // Create the enemy sprite using the physics group, starting at the first frame of its animation
        const enemy = this.enemies.create(startX, yPos, 'enemies', selectedEnemy.frame);
        enemy.setOrigin(0.5, 1); // Bottom-center origin
        enemy.setScale(2.0); // Adjust scale if needed (make smaller/larger)
        enemy.setCollideWorldBounds(false); // Allow them to move off-screen

        // Play the correct animation for the spawned enemy type
        enemy.play(selectedEnemy.anim);

        // Optional: Give enemies slightly varied speed
        // let speedVariation = Phaser.Math.FloatBetween(0.9, 1.2);
        // enemy.speedMultiplier = speedVariation; // You'd use this in the update loop

        console.log(`Spawned enemy type ${selectedEnemy.name} (anim: ${selectedEnemy.anim}) at x: ${startX.toFixed(0)}`);
    }

    triggerGameOver(enemy) {
        // Prevent this function from running multiple times
        if (this.isGameOver) {
            return;
        }
        this.isGameOver = true;
        console.log('Game Over! Enemy reached the wizard.');

        // Stop everything
        this.physics.pause(); // Stop all physics movement
        // Stop wave timers
        if (this.waveSpawnTimer) {
            this.waveSpawnTimer.remove(false);
            this.waveSpawnTimer = null;
        }
        if (this.nextWaveTimer) {
            this.nextWaveTimer.remove(false);
            this.nextWaveTimer = null;
        }
        this.enemies.children.each(e => e.anims?.stop()); // Stop enemy animations
        this.wizard.anims.stop();

        // Stop player input
        this.input.keyboard.off('keydown', this.handleKeyInput, this);

        // Visual feedback
        this.cameras.main.shake(300, 0.015);
        this.wizard.setTint(0xff6666); // Tint wizard slightly red
        if (enemy) {
            enemy.setTint(0xff6666); // Tint the specific enemy red
        }

        // Stop background music and play game over sound
        this.sound.stopAll();
        this.sound.play('gameOverSound');

        // Display Game Over message
        this.add.rectangle(this.cameras.main.width / 2, this.cameras.main.height / 2, 500, 200, 0x000000, 0.8)
           .setOrigin(0.5)
           .setDepth(10); // Ensure it's on top

        this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 - 40, 'GAME OVER', {
            fontSize: '64px', fill: '#ff0000', fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 4
        }).setOrigin(0.5).setDepth(11);

        this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 40, 'Click to Restart', {
             fontSize: '32px', fill: '#ffffff'
         }).setOrigin(0.5).setDepth(11);


         // --- High Score Logic (using localStorage) ---
         let highScore = parseInt(localStorage.getItem('mathGameHighScore') || '0');
         if (this.score > highScore) {
            highScore = this.score;
            localStorage.setItem('mathGameHighScore', highScore.toString());
            // Add text indicating new high score
             this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 80, `New High Score: ${highScore}`, {
                  fontSize: '24px', fill: '#FFD700' // Gold color
              }).setOrigin(0.5).setDepth(11);
         } else {
             // Show current and high score
              this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2 + 80, `High Score: ${highScore}`, {
                  fontSize: '24px', fill: '#ffffff'
              }).setOrigin(0.5).setDepth(11);
         }


        // --- Restart Listener ---
        // Wait a short moment before enabling restart clicks
        this.time.delayedCall(500, () => {
            this.input.once('pointerdown', () => {
                console.log('Restarting game...');
                this.isGameOver = false; // Reset flag before restarting
                this.sound.stopAll(); // Stop game over sound before restarting
                // Fade out and restart the scene
                this.cameras.main.fadeOut(500, 0, 0, 0, (camera, progress) => {
                    if (progress === 1) {
                       this.scene.restart();
                    }
                });
            });
        });
    }
}
