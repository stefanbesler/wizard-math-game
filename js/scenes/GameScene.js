// Import the new enemy classes
import Shadow from '../sprites/Shadow.js';
import Ghost from '../sprites/Ghost.js';
import Plant from '../sprites/Plant.js';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');

        // Player Health
        this.maxHearts = 3;
        this.currentHearts = 0; // Will be set in create
        this.invulnerable = false;
        this.invulnerableTimer = null;
        this.heartOutlines = [];
        this.hearts = [];

        // Game state variables
        this.wizard = null;
        this.enemies = null; // Physics group for enemies
        this.projectiles = null; // Physics group for spells (if needed later)
        this.particles = null; // Particle emitter manager

        // UI Elements
        this.questionText = null;
        this.inputText = null;
        this.scoreText = null;
        // Heart UI elements are now properties above

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

        // this.enemySpeed = 45; // Removed - speed is now per-enemy
        this.gameOverLineX = 150; // X-coordinate where enemies trigger player damage
        this.isGameOver = false;
        this.selectedTables = [3]; // Default value, will be overwritten by init

        // Statistics Collection
        this.sessionStats = []; // Array to store { num1, num2, answerGiven, correctAnswer, timeTaken, correct }
        this.questionStartTime = 0; // Timestamp when the current question was shown
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
        this.isGameOver = false; // Reset game over flag
        this.invulnerable = false; // Reset invulnerability
        this.currentHearts = this.maxHearts; // Reset health

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
        // Create a physics group for enemies.
        // We will add instances of our custom Enemy classes to this group.
        // The classType helps Phaser know what kind of objects to expect,
        // although we'll be creating them manually anyway.
        this.enemies = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite, // Base type, actual instances vary
            runChildUpdate: false // We will manually call update on each enemy
        });

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

        // --- Health UI (Hearts) ---
        this.heartOutlines = [];
        this.hearts = [];
        const heartStartX = this.cameras.main.width - 40; // Start from right edge
        const heartY = 70; // Position below score
        const heartSpacing = 40;

        for (let i = 0; i < this.maxHearts; i++) {
            // Add outlines first (background)
            const outline = this.add.sprite(heartStartX - i * heartSpacing, heartY, 'heart').setOrigin(0.5);
            this.heartOutlines.push(outline);

            // Add filled hearts on top
            const fill = this.add.sprite(heartStartX - i * heartSpacing, heartY, 'heart-filled').setOrigin(0.5);
            this.hearts.push(fill);
        }
        this.updateHealthUI(); // Initial display based on currentHearts

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
        // Manually update each enemy instance
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active) { // Check if enemy is active
                // Call the enemy's own update method
                enemy.update(delta);

                // --- Player Damage Check ---
                // Check if enemy crossed the line AND player is not invulnerable
                if (enemy.x < this.gameOverLineX && !this.invulnerable) {
                    this.playerTakeDamage(enemy); // Player takes damage
                    // Note: playerTakeDamage handles invulnerability timing
                }
            }
        });
    }

    // --- Player Health and Damage ---

    playerTakeDamage(enemy) {
        if (this.isGameOver || this.invulnerable) {
            return; // Already game over or recently hit
        }

        console.log('Player hit!');
        this.currentHearts--;
        this.updateHealthUI();

        // Make player invulnerable for a short time
        this.invulnerable = true;
        this.wizard.setAlpha(0.5); // Visual feedback for invulnerability

        // Play hurt sound
        this.sound.play('wrongSound'); // Maybe use a different sound?
        this.cameras.main.shake(150, 0.008); // Shake camera

        // Destroy the enemy that hit the player
        if (enemy && enemy.active) {
            enemy.destroy();
        }

        // Set timer to end invulnerability
        if (this.invulnerableTimer) {
            this.invulnerableTimer.remove(false); // Remove previous timer if any
        }
        this.invulnerableTimer = this.time.delayedCall(1500, () => { // 1.5 seconds invulnerability
            this.invulnerable = false;
            this.wizard.setAlpha(1.0); // Restore wizard visibility
            console.log('Player invulnerability ended.');
        }, [], this);


        // Check for actual game over (no hearts left)
        if (this.currentHearts <= 0) {
            this.triggerGameOver(); // Game over triggered by health loss
        }
    }

    updateHealthUI() {
        // Update visibility of filled hearts based on currentHearts
        for (let i = 0; i < this.maxHearts; i++) {
            // Hearts array is filled right-to-left visually (index 0 is rightmost)
            // Player loses hearts from right to left
            if (i < this.currentHearts) {
                this.hearts[i].setVisible(true);
            } else {
                this.hearts[i].setVisible(false);
            }
        }
    }

    // --- Input and Answer Handling ---

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
        const timeTaken = Date.now() - this.questionStartTime;
        const playerAnswerStr = this.currentInput; // Keep the raw input
        const playerAnswerNum = parseInt(playerAnswerStr); // Attempt to parse
        const correctAnswer = this.currentQuestion.answer;
        const isCorrect = !isNaN(playerAnswerNum) && playerAnswerNum === correctAnswer;

        // Record the attempt
        this.sessionStats.push({
            num1: this.currentQuestion.num1,
            num2: this.currentQuestion.num2,
            answerGiven: playerAnswerStr, // Store the raw string input
            correctAnswer: correctAnswer,
            timeTaken: timeTaken,
            correct: isCorrect
        });

        console.log(`Attempt recorded: ${this.currentQuestion.num1}x${this.currentQuestion.num2}, Given: ${playerAnswerStr}, Correct: ${correctAnswer}, Time: ${timeTaken}ms, Result: ${isCorrect}`);

        // Check if the parsed number is valid and matches the correct answer
        if (isCorrect) {
            this.handleCorrectAnswer();
        } else {
            // Pass the parsed answer attempt for potential feedback, though we might not use it
            this.handleWrongAnswer(playerAnswerNum);
        }
        // Clear input field after submitting (moved here to happen regardless of correct/wrong)
        this.currentInput = '';
        this.updateInputText(); // Update display after clearing
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
        // Get active enemies only
        const activeEnemies = this.enemies.getChildren().filter(e => e.active);
        let closestEnemy = this.physics.closest(this.wizard, activeEnemies);

        if (closestEnemy) {
            console.log(`Targeting ${closestEnemy.constructor.name} at x: ${closestEnemy.x.toFixed(0)}`);

            // Play cast sound
            this.sound.play('castSound');

            // --- Damage the Enemy ---
            // Call the enemy's takeDamage method
            const defeated = closestEnemy.takeDamage(1); // Deal 1 damage per correct answer

            if (defeated) {
                // Enemy was defeated by this hit
                console.log(`${closestEnemy.constructor.name} defeated by attack.`);
                this.sound.play('enemyHitSound', { delay: 0.15 }); // Play death sound

                // --- Use Built-in Effects for Death ---
                // 1. Camera Flash (optional, maybe only for harder enemies?)
                // this.cameras.main.flash(150, 255, 255, 255);

                // 2. Enemy Death Tween (Scale up/Fade out - handled in Enemy.die() or here)
                // The takeDamage method already handles tinting.
                // The die method currently just destroys. We could add tweens there
                // or keep the tween logic here if preferred. Let's assume die() handles it for now.

                // Increase score only when an enemy is actually defeated
                this.score += 10; // Or maybe score based on enemy type?
                this.scoreText.setText('Score: ' + this.score);

            } else {
                // Enemy was hit but survived (e.g., Plant)
                console.log(`${closestEnemy.constructor.name} survived the hit.`);
                // Play a different, less impactful hit sound?
                // this.sound.play('hitSound', { volume: 0.5 });
            }

            // Note: Enemy destruction is handled by its own takeDamage/die methods

        } else {
            console.log('Correct answer, but no active enemies to target.');
            // Still play cast animation even if no target? Your choice.
            // If not, move the wizard.play('wizard_cast') inside the if(closestEnemy) block.
        }

            // Note: Enemy destruction is handled within its takeDamage/die methods now.
            // The score increase was moved inside the 'defeated' block.

        } else {
             console.log('Correct answer, but no active enemies to target.');
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
        // Optional: Make enemies move slightly faster or closer? (Handled by enemy update now)
        // We could temporarily boost speed here if desired:
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

        // Start spawning enemies for the current wave, considering 'loner' property
        this.scheduleNextEnemySpawn(0); // Start spawning the first enemy immediately
    }

    scheduleNextEnemySpawn(spawnedCount) {
        if (this.isGameOver || spawnedCount >= this.enemiesPerWave) {
             // Wave spawning finished, schedule the next wave
            console.log(`Wave ${this.waveNumber} spawning complete.`);
            if (this.waveSpawnTimer) this.waveSpawnTimer.remove(false); // Clean up timer
            this.nextWaveTimer = this.time.delayedCall(this.timeBetweenWaves, this.startNextWave, [], this);
            return;
        }

        // Spawn one enemy now
        const enemyType = this.chooseEnemyType(); // Decide which enemy to spawn
        const spawnedEnemy = this.spawnEnemy(enemyType); // Spawn it

        let delayForNext = this.timeBetweenEnemiesInWave;

        // If the spawned enemy is a 'loner', increase delay significantly before next spawn in wave
        if (spawnedEnemy && spawnedEnemy.isLoner) {
            delayForNext *= 2.5; // Example: Make loners create bigger gaps
            console.log(`Spawned a loner (${spawnedEnemy.constructor.name}), increasing next spawn delay to ${delayForNext}ms`);
        }

        // Schedule the next spawn in this wave
        this.waveSpawnTimer = this.time.delayedCall(delayForNext, () => {
            this.scheduleNextEnemySpawn(spawnedCount + 1);
        }, [], this);
    }


    // --- Individual Enemy Spawning ---

    chooseEnemyType() {
        // Basic random selection for now, could be weighted later
        const rand = Phaser.Math.Between(1, 10);
        if (rand <= 4) return Ghost; // 40% chance Ghost
        if (rand <= 7) return Shadow; // 30% chance Shadow
        return Plant; // 30% chance Plant
    }

    spawnEnemy(EnemyClass) {
        // This function now creates a single enemy instance of the specified class

        if (!EnemyClass) {
            console.error("No EnemyClass provided to spawnEnemy!");
            return null;
        }

        // Calculate spawn position: off-screen right, vertically aligned with wizard's base
        const yPos = this.cameras.main.height - 80; // Match wizard Y pos
        const startX = this.cameras.main.width + Phaser.Math.Between(50, 100); // Start varied off-screen right

        // Create an instance of the specific enemy class
        const enemy = new EnemyClass(this, startX, yPos);

        // Add the enemy to the physics group
        this.enemies.add(enemy);

        // Log is now handled inside the Enemy constructor
        // console.log(`Spawned enemy type ${enemy.constructor.name} at x: ${startX.toFixed(0)}`);
        return enemy; // Return the spawned enemy instance
    }

    triggerGameOver() { // Removed enemy parameter - triggered by health loss now
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
        // Stop enemy updates and animations
        this.enemies.getChildren().forEach(e => {
            if (e.active) {
                e.body.stop(); // Stop physics body
                e.anims?.stop(); // Stop animation
            }
        });
        this.wizard.anims.stop();

        // Stop player input
        this.input.keyboard.off('keydown', this.handleKeyInput, this);

        // Visual feedback
        this.cameras.main.shake(300, 0.015);
        this.wizard.setTint(0xff6666); // Tint wizard slightly red
        // Don't tint specific enemy anymore, it's triggered by health loss

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

        // Removed 'Click to Restart' text - using buttons now

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

        // --- Action Buttons ---
        const buttonY = this.cameras.main.height / 2 + 130; // Position below high score
        const buttonSpacing = 200;

        // Play Again Button
        const againButton = this.add.text(this.cameras.main.width / 2 - buttonSpacing / 2, buttonY, 'Play Again', {
            fontSize: '32px', fill: '#0f0', backgroundColor: '#333', padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(11).setInteractive();

        againButton.on('pointerdown', () => {
            console.log('Restarting game from Game Over...');
            this.sound.stopAll();
            this.cameras.main.fadeOut(300, 0, 0, 0, (camera, progress) => {
                if (progress === 1) {
                    // Pass the original selected tables back when restarting
                    // Reset necessary game state variables before restarting
                    this.scene.restart({ selectedTables: this.selectedTables });
                }
            });
        });
        againButton.on('pointerover', () => againButton.setStyle({ fill: '#8f8' }));
        againButton.on('pointerout', () => againButton.setStyle({ fill: '#0f0' }));


        // Statistics Button
        const statsButton = this.add.text(this.cameras.main.width / 2 + buttonSpacing / 2, buttonY, 'Statistics', {
            fontSize: '32px', fill: '#ff0', backgroundColor: '#333', padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setDepth(11).setInteractive();

        statsButton.on('pointerdown', () => {
            console.log('Going to Statistics scene...');
            this.sound.stopAll();
            // Pass session data and selected tables to the Statistics Scene
            const statsData = {
                sessionStats: this.sessionStats,
                selectedTables: this.selectedTables // Pass selected tables too
            };
            // Use scene.start, not restart, to go to a different scene
            this.scene.start('StatisticsScene', statsData);
        });
        statsButton.on('pointerover', () => statsButton.setStyle({ fill: '#ff8' }));
        statsButton.on('pointerout', () => statsButton.setStyle({ fill: '#ff0' }));


        // Disable player input until buttons are ready (slight delay to prevent accidental clicks)
        // Note: Keyboard input was already disabled earlier in triggerGameOver
        // This ensures pointer input is also disabled until buttons appear.
        this.input.enabled = false;
        this.time.delayedCall(500, () => {
             // Re-enable pointer input specifically for the buttons
             this.input.enabled = true;
             console.log("Pointer input re-enabled for Game Over buttons.");
        });

    } // End triggerGameOver
} // End Class
