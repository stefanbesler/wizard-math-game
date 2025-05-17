// Import enemy classes
import Shadow from '../sprites/Shadow.js';
import Ghost from '../sprites/Ghost.js';
import Plant from '../sprites/Plant.js';
// Import EXP Droplet
import ExpDroplet from '../sprites/ExpDroplet.js';

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
        // this.projectiles = null; // Removed, using specific groups below
        // this.particles = null; // Removed
        this.isPausedForLevelUp = false; // Flag for level up pause state
        this.isPaused = false; // Flag for manual pause state

        // UI Elements
        this.questionText = null;
        this.inputText = null;
        this.scoreText = null;
        // Heart UI elements are properties above
        this.expBar = null; // NEW: EXP bar graphics
        this.expBarBg = null; // NEW: EXP bar background
        this.levelText = null; // NEW: Level display text
        this.levelUpContainer = null; // NEW: Container for level up UI
        this.pauseText = null; // Text display for manual pause

        // Gameplay Variables
        this.currentInput = '';
        this.currentQuestion = { num1: 0, num2: 0, answer: 0, operator: '' };
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
        this.difficulty = 1;

        // Statistics Collection
        this.sessionStats = []; // Array to store stats
        this.questionStartTime = 0; // Timestamp for question timing

        // --- NEW: Leveling System ---
        this.playerLevel = 1;
        this.currentExp = 0;
        this.expToNextLevel = 3; // Initial EXP needed for level 2

        // --- NEW: Spell System ---
        this.spells = {
            // Fireball REMOVED
            ice: {
                level: 0,
                cooldown: 8000,
                lastCast: 0,
                duration: 3000 // ms freeze duration - INCREASED BASE DURATION
            }
        };
        this.spellKey = null; // To store the keyboard key for spells
        // this.fireballCooldownIcon = null; // REMOVED
        this.iceCooldownIcon = null;      // NEW: UI for ice cooldown
        this.pauseKey = null; // Key for manual pause

        // --- NEW: Physics Groups ---
        this.expDroplets = null; // Group for EXP droplets
        // this.fireballs = null; // REMOVED
        this.allowedEnemyTypes = []; // Tracks enemies allowed in the current wave
        this.currentTargetEnemy = null; // NEW: The enemy the current question is attached to
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
        this.difficulty = data.difficulty;
        console.log('GameScene will use tables:', this.selectedTables);
        
        // --- Reset state on init ---
        this.playerLevel = 1;
        this.currentExp = 0;
        this.expToNextLevel = 3;
        this.isPausedForLevelUp = false;
        this.isPaused = false; // Reset manual pause state on init
        this.score = 0;
        this.waveNumber = 0;
        this.sessionStats = [];
        // Reset spell levels and cooldowns if restarting
        // Fireball REMOVED
        this.spells.ice.level = 0;
        this.spells.ice.lastCast = 0;
        this.spells.ice.duration = 3000; // Reset duration to new base
        // Reset health etc. will happen in create()
    }


    create() {
        console.log('GameScene: create');
        this.isGameOver = false;
        this.invulnerable = false;
        this.currentHearts = this.maxHearts;
        this.isPausedForLevelUp = false; // Ensure reset here too

        // --- World Setup ---
        // Background
        this.add.image(this.cameras.main.width / 2, this.cameras.main.height / 2, 'gameBackground').setOrigin(0.5);

        // Optional: Add a visual line for Game Over (debugging)
        // this.add.line(0, 0, this.gameOverLineX, 0, this.gameOverLineX, this.cameras.main.height, 0xff0000, 0.5).setOrigin(0);

        // --- Player Character ---
        // Place wizard on the left, bottom-aligned
        this.wizard = this.physics.add.sprite(100, this.cameras.main.height - 80, 'wizard') // Use physics.add.sprite
            .setOrigin(0.5, 1) // Origin bottom-center
            .setScale(2.5);    // Make wizard larger

        // --- Adjust Wizard Physics Body ---
        // Disable gravity for the wizard
        this.wizard.body.allowGravity = false;
        // Adjust the body size to better match the visual sprite (tweak as needed)
        // Since origin is bottom-center, offset needs careful adjustment
        const bodyWidth = this.wizard.width * 0.4 * this.wizard.scaleX; // Smaller collision width
        const bodyHeight = this.wizard.height * 0.7 * this.wizard.scaleY; // Adjust height
        this.wizard.body.setSize(bodyWidth, bodyHeight);
        // Offset Y upwards because origin is at the bottom
        this.wizard.body.setOffset(this.wizard.width * 0.5 - bodyWidth / 2, this.wizard.height - bodyHeight);

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
            runChildUpdate: true // Let enemies run their own update
        });

        // --- NEW: Physics Groups ---
        this.expDroplets = this.physics.add.group({
            classType: ExpDroplet,
            runChildUpdate: true // Let droplets manage their own updates
        });
        // Fireball group REMOVED


        // --- UI Elements ---
        // Question Text (Will be positioned dynamically)
        this.questionText = this.add.text(0, 0, '', { // Start at 0,0, empty text
            fontSize: '28px', fill: '#ffffff', fontStyle: 'bold', // Slightly smaller font
            stroke: '#000000', strokeThickness: 4,
            align: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)', // Add background for readability
            padding: { x: 8, y: 4 }
        }).setOrigin(0.5, 1).setDepth(10).setVisible(false); // Origin bottom-center, high depth, initially hidden

        // Input Text Display (Will be positioned dynamically)
        this.inputText = this.add.text(0, 0, '_', { // Start at 0,0
            fontSize: '24px', fill: '#FFD700', // Slightly smaller font
            fontStyle: 'bold',
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: { x: 10, y: 5 },
            align: 'center'
        }).setOrigin(0.5, 1).setDepth(10).setVisible(false); // Origin bottom-center, high depth, initially hidden

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

        // --- NEW: EXP Bar UI ---
        const barWidth = 180;
        const barHeight = 18;
        const barX = 20;
        const barY = 20; // Position top-left

        this.expBarBg = this.add.graphics().setDepth(1);
        this.expBarBg.fillStyle(0x333333, 0.8); // Dark grey background
        this.expBarBg.fillRect(barX, barY, barWidth, barHeight);

        this.expBar = this.add.graphics().setDepth(2); // On top of background
        this.expBar.fillStyle(0x00ffff, 1); // Cyan color for EXP
        this.expBar.fillRect(barX, barY, 0, barHeight); // Start empty

        this.levelText = this.add.text(barX + barWidth / 2, barY + barHeight / 2, `Level: ${this.playerLevel}`, {
            fontSize: '14px', fill: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(3); // On top of the bar

        this.updateExpBar(); // Draw initial state

        // --- NEW: Spell Cooldown UI ---
        this.createSpellCooldownUI();


        // --- Input Handling ---
        this.input.keyboard.on('keydown', this.handleKeyInput, this);
        // Add key for casting spells
        this.spellKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        // Add key for pausing
        this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);


        // --- Initial Game State ---
        this.generateQuestion();
        this.currentInput = '';
        this.updateInputText();

        // --- Start Enemy Wave Spawning ---
        // Start the first wave after an initial delay
        const initialSpawnDelay = this.difficulty > 1 ? 0 : 3000; // Time before the very first wave starts
        this.nextWaveTimer = this.time.delayedCall(initialSpawnDelay, this.startNextWave, [], this);
        console.log(`First wave scheduled in ${initialSpawnDelay / 1000}s`);

        // --- NEW: Collisions / Overlaps ---
        this.physics.add.overlap(this.wizard, this.expDroplets, this.collectExpDroplet, null, this);
        // Fireball overlap REMOVED

        // --- Level Up Screen (create hidden) ---
        this.createLevelUpScreen();

        // --- NEW: Pause Text (create hidden) ---
        this.pauseText = this.add.text(this.cameras.main.width / 2, this.cameras.main.height / 2, 'PAUSED', {
            fontSize: '64px', fill: '#ffff00', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5).setDepth(30).setVisible(false); // High depth, initially hidden

        // Fade in the scene
        this.cameras.main.fadeIn(500, 0, 0, 0);

         // Start background music for the game scene
         if (!this.sound.get('gameMusic')?.isPlaying) {
            this.sound.play('gameMusic', { loop: true, volume: 0.4 }); // Adjust volume as needed
         }

         // --- Enable Physics Body for Droplets on Reuse ---
         // Ensure the physics body is enabled when a droplet is reused from the pool
         this.expDroplets.createCallback = (droplet) => {
             droplet.body?.setEnable(true);
         };
         // Also handle removal (disable body when pooled)
         this.expDroplets.removeCallback = (droplet) => {
             droplet.body?.setEnable(false);
         };
    }

    update(time, delta) {
        // --- Check for Game Over ---
        if (this.isGameOver) {
            return;
        }

        // --- Handle Manual Pause Input ---
        // Allow pausing only if not already paused for level up
        if (Phaser.Input.Keyboard.JustDown(this.pauseKey) && !this.isPausedForLevelUp) {
            this.togglePause();
        }

        // --- Check for ALL pause states ---
        if (this.isPaused || this.isPausedForLevelUp) {
            // Optional: Could add visual indication of pause like dimming
            return; // Skip updates if game over or paused for level up / manually
        }


        // --- Enemy Movement and Checks ---
        // Enemies now run their own update via the group config
        // We still need to check for crossing the line here
        // Check for player damage
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active) {
                // --- Player Damage Check ---
                if (enemy.x < this.gameOverLineX && !this.invulnerable) {
                    this.playerTakeDamage(enemy); // Player takes damage
                    // Note: playerTakeDamage handles invulnerability timing
                }
            }
        });

        // --- NEW: Spell Casting Input ---
        if (Phaser.Input.Keyboard.JustDown(this.spellKey)) {
            // Only check for Ice spell now
            if (this.spells.ice.level > 0 && time > this.spells.ice.lastCast + this.spells.ice.cooldown) {
                this.castIceSpell(time);
            }
        }

        // Fireball update logic REMOVED

        // --- NEW: Update Spell Cooldown UI ---
        this.updateSpellCooldownUI(time);

        // --- NEW: Update Floating Calculation UI ---
        this.updateFloatingUI();
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
            this.triggerGameOver();
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
        // --- Ignore input if paused or game over ---
        if (this.isGameOver || this.isPausedForLevelUp || this.isPaused) {
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
        // Ensure visibility matches question text
        this.inputText.setVisible(this.questionText.visible);
    }

    generateQuestion() {
        // --- NEW: Target Selection ---
        // Only generate a new question if there isn't already an active target
        if (this.currentTargetEnemy && this.currentTargetEnemy.active) {
            console.log("generateQuestion called but current target is still active.");
            return;
        }

        // Find potential targets: active enemies reasonably far from the left edge
        const potentialTargets = this.enemies.getChildren().filter(e =>
            e.active && e.x > this.gameOverLineX + 100 // Ensure they are not too close to game over line
        );

        if (potentialTargets.length === 0) {
            console.log("No suitable enemy target found for new question.");
            this.currentTargetEnemy = null;
            this.questionText.setVisible(false); // Hide UI if no target
            this.inputText.setVisible(false);
            return; // Wait until an enemy appears
        }

        // Select a random enemy from the potential targets
        this.currentTargetEnemy = Phaser.Math.RND.pick(potentialTargets);
        console.log(`New target selected: ${this.currentTargetEnemy.constructor.name} at x: ${this.currentTargetEnemy.x.toFixed(0)}`);

        // --- Question Generation (existing logic) ---
        const Operator = {
            MULTIPLY: '×',
            ADD: '+',
            SUBTRACT: '−',
        };

        const operatorKeys = Object.keys(Operator);
        const randomOperatorKey = operatorKeys[Phaser.Math.Between(0, operatorKeys.length - 1)];
        const operatorSymbol = Operator[randomOperatorKey];        
        let num1 = Phaser.Math.Between(1,10);
        let num2 = Phaser.Math.Between(0,9-num1);
        
        switch (operatorSymbol) {
            case Operator.MULTIPLY:
                num1 = Phaser.Math.RND.pick(this.selectedTables);
                num2 = Phaser.Math.Between(1,10);
                this.currentQuestion.num1 = num1;
                this.currentQuestion.num2 = num2;
                this.currentQuestion.operator = operatorSymbol;                 
                this.currentQuestion.answer = this.currentQuestion.num1 * this.currentQuestion.num2;
                break;
            case Operator.ADD:
                this.currentQuestion.num1 = num1;
                this.currentQuestion.num2 = num2;
                this.currentQuestion.operator = operatorSymbol;                 
                this.currentQuestion.answer = this.currentQuestion.num1 + this.currentQuestion.num2;
                break;
            case Operator.SUBTRACT:
                console.log(num1 > num2);
                this.currentQuestion.num1 = num1 > num2 ? num1 : num2;
                this.currentQuestion.num2 = num1 > num2 ? num2 : num1;
                this.currentQuestion.operator = operatorSymbol;                 
                this.currentQuestion.answer = this.currentQuestion.num1 - this.currentQuestion.num2;
                break;
        }        

        // Display question
        this.questionText.setText(`${this.currentQuestion.num1} ${operatorSymbol} ${this.currentQuestion.num2} = ?`);
        this.questionText.setVisible(true);
        this.inputText.setVisible(true);
        this.updateInputText();
        
        // Debug log
        console.log(`New question: ${num1} ${operatorSymbol} ${num2} = ${this.currentQuestion.answer}`);

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

        // --- Attack the CURRENT TARGET Enemy ---
        if (this.currentTargetEnemy && this.currentTargetEnemy.active) {
            const targetEnemy = this.currentTargetEnemy; // Use the stored target
            console.log(`Attacking target ${targetEnemy.constructor.name} at x: ${targetEnemy.x.toFixed(0)}`);

            // Play cast sound
            this.sound.play('castSound');

            // --- Create Lightning Effect ---
            // --- Create Lightning Effect ---
            // Estimate wand position (adjust offsets as needed)
            const wandX = this.wizard.x + 20; // Slightly right of wizard center
            const wandY = this.wizard.y - 60; // Above wizard center

            // Calculate target position based on the target enemy's visual center
            const bounds = targetEnemy.getBounds();
            const targetX = bounds.centerX;
            const targetY = bounds.centerY + Phaser.Math.Between(-10, 10); // Add jitter

            this.createLightning(wandX, wandY, targetX, targetY);


            // --- Damage the Target Enemy ---
            const defeated = targetEnemy.takeDamage(1); // Deal 1 damage

            if (defeated) {
                // Target Enemy was defeated by this hit
                console.log(`Target ${targetEnemy.constructor.name} defeated by attack.`);
                this.sound.play('enemyHitSound', { delay: 0.15 }); // Play death sound

                // --- Use Built-in Effects for Death ---
                // this.cameras.main.flash(150, 255, 255, 255);

                // 2. Enemy Death Tween (Scale up/Fade out - handled in Enemy.die() or here)
                // The takeDamage method already handles tinting.
                // The die method currently just destroys. We could add tweens there
                // or keep the tween logic here if preferred. Let's assume die() handles it.

                // Increase score
                this.score += 10; // Score for defeating the target
                this.scoreText.setText('Score: ' + this.score);

                // --- NEW: Clear target and generate next question ---
                this.currentTargetEnemy = null; // Clear the defeated target
                this.questionText.setVisible(false); // Hide UI temporarily
                this.inputText.setVisible(false);
                // Schedule the next question generation after a short delay
                this.time.delayedCall(750, this.generateQuestion, [], this); // Delay allows death effects to play

            } else {
                // Target Enemy was hit but survived (e.g., Plant)
                console.log(`Target ${targetEnemy.constructor.name} survived the hit.`);
                // Keep the same target and question, DO NOT generate a new one yet.
                // Play a different, less impactful hit sound?
                // this.sound.play('hitSound', { volume: 0.5 });
            }

        } else {
            console.log('Correct answer, but the target enemy is no longer active.');
            // Clear the invalid target and try to generate a new question immediately
            this.currentTargetEnemy = null;
            this.generateQuestion();
        }
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

    // --- Visual Effects ---

    /**
     * Creates a lightning bolt effect from a start point to an end point.
     * @param {number} startX - The starting X coordinate.
     * @param {number} startY - The starting Y coordinate.
     * @param {number} endX - The ending X coordinate (enemy center X).
     * @param {number} endY - The ending Y coordinate (enemy center Y with jitter).
     */
    createLightning(startX, startY, endX, endY) {
        const segments = 12; // More segments for smoother animation/jitter
        const jitter = 15;   // Max pixel offset for the zigzag
        const duration = 75; // Total duration for the lightning animation (ms)
        const delayBetweenSegments = duration / segments;
        const glowColor = 0xffff88; // Soft yellow for glow
        const glowAlpha = 0.25;
        const glowWidth = 10;
        const mainColor = 0xFFFF00; // Bright yellow for main bolt
        const mainAlpha = 1.0;
        const mainWidth = 3;
        const impactShakeDuration = 80;
        const impactShakeIntensity = 0.005;
        const fadeOutDuration = 100; // How long the bolt stays visible after drawing

        // --- Generate Points ---
        const points = [];
        points.push(new Phaser.Math.Vector2(startX, startY)); // Start point

        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            // Base position using linear interpolation
            let x = Phaser.Math.Linear(startX, endX, t);
            let y = Phaser.Math.Linear(startY, endY, t);
            // Add random jitter, except for the very start and end points
            if (i < segments) {
                x += Phaser.Math.Between(-jitter, jitter);
                y += Phaser.Math.Between(-jitter, jitter);
            }
            points.push(new Phaser.Math.Vector2(x, y));
        }

        // --- Create Graphics Objects ---
        // Glow layer (drawn first, underneath)
        const glowGraphics = this.add.graphics().setDepth(5); // Ensure glow is behind main bolt if needed
        glowGraphics.lineStyle(glowWidth, glowColor, glowAlpha);

        // Main lightning bolt layer
        const lightningGraphics = this.add.graphics().setDepth(6); // Ensure main bolt is on top
        lightningGraphics.lineStyle(mainWidth, mainColor, mainAlpha);

        // --- Animate Drawing ---
        let currentSegment = 0;
        const drawSegment = () => {
            if (currentSegment >= points.length - 1) {
                // Animation finished
                // Play impact sound (reuse castSound or add a dedicated 'zap' sound)
                this.sound.play('castSound', { volume: 0.6 }); // Consider a unique sound: 'zapSound'
                // Optional: Camera shake on impact
                this.cameras.main.shake(impactShakeDuration, impactShakeIntensity);

                // Set a timer to destroy the graphics after a short delay
                this.time.delayedCall(fadeOutDuration, () => {
                    glowGraphics.destroy();
                    lightningGraphics.destroy();
                });
                return; // Stop the loop
            }

            const p1 = points[currentSegment];
            const p2 = points[currentSegment + 1];

            // Draw segment on both graphics objects
            glowGraphics.strokeLineShape(new Phaser.Geom.Line(p1.x, p1.y, p2.x, p2.y));
            lightningGraphics.strokeLineShape(new Phaser.Geom.Line(p1.x, p1.y, p2.x, p2.y));

            currentSegment++;
        };

        // Use a timed event to call drawSegment repeatedly
        this.time.addEvent({
            delay: delayBetweenSegments,
            callback: drawSegment,
            callbackScope: this,
            repeat: segments // Run 'segments' times to draw all lines between the points
        });
    }


    // --- Wave Management ---

    startNextWave() {
        // --- Check pause state ---
        if (this.isGameOver || this.isPausedForLevelUp || this.isPaused) return; // Added check for manual pause

        this.waveNumber++;
        this.enemiesSpawnedThisWave = 0;

        // --- Define Difficulty Phases ---
        const phase1EndWave = 4;  // Waves 1-4: Ghosts only
        const phase2EndWave = 9;  // Waves 5-9: Ghosts & Shadows
        // Phase 3 (Waves 10+): All enemies

        // --- Set Parameters Based on Phase ---
        if (this.waveNumber <= phase1EndWave) {
            // Phase 1: Ghosts Only, Very Easy
            this.allowedEnemyTypes = [Ghost];
            this.enemiesPerWave = 1 + Math.floor(this.waveNumber / 2) * this.difficulty; // 1, 1, 2, 2
            this.timeBetweenWaves = Phaser.Math.Between(13000, 15000) / this.difficulty; // Long breaks (13-15s)
            this.timeBetweenEnemiesInWave = 1500 / this.difficulty; // Slower spawns within wave
            console.log(`--- Phase 1 (Wave ${this.waveNumber}) ---`);

        } else if (this.waveNumber <= phase2EndWave) {
            // Phase 2: Ghosts & Shadows, Introduce Speed
            this.allowedEnemyTypes = [Ghost, Shadow];
            // Start at 2, increase slowly
            this.enemiesPerWave = 2 + Math.floor((this.waveNumber - phase1EndWave) / 2) * this.difficulty; // 2, 2, 3, 3, 4
            this.timeBetweenWaves = Math.max(this.minTimeBetweenWaves + 2000, 12000 - (this.waveNumber - phase1EndWave) * 400) / this.difficulty; // Decrease faster (12s -> ~10s)
            this.timeBetweenEnemiesInWave = 1200 / this.difficulty; // Slightly faster spawns
            console.log(`--- Phase 2 (Wave ${this.waveNumber}) ---`);

        } else {
            // Phase 3: All Enemies, Introduce Toughness
            this.allowedEnemyTypes = [Ghost, Shadow, Plant];
            // Start at 3, increase steadily
            this.enemiesPerWave = 3 + Math.floor((this.waveNumber - phase2EndWave) / 2) * this.difficulty; // 3, 3, 4, 4, 5...
            this.timeBetweenWaves = Math.max(this.minTimeBetweenWaves, 9000 - (this.waveNumber - phase2EndWave) * 300) / this.difficulty; // Decrease towards min (9s -> 3s)
            this.timeBetweenEnemiesInWave = 1000 / this.difficulty; // Standard spawn speed
            console.log(`--- Phase 3 (Wave ${this.waveNumber}) ---`);
        }

        console.log(`Starting Wave ${this.waveNumber}: Spawning ${this.enemiesPerWave} enemies (${this.allowedEnemyTypes.map(e => e.name).join(', ')}). Next wave in ${this.timeBetweenWaves / 1000}s.`);

        // Start spawning enemies for the current wave
        this.scheduleNextEnemySpawn(0); // Start spawning the first enemy immediately
    }

    scheduleNextEnemySpawn(spawnedCount) {
        // --- NEW: Check pause state and completion ---
         if (this.isGameOver || this.isPausedForLevelUp || spawnedCount >= this.enemiesPerWave) {
            // Wave spawning finished or paused, schedule the next wave *only if finished and not paused/over*
            if (!this.isPausedForLevelUp && !this.isGameOver && spawnedCount >= this.enemiesPerWave) {
                console.log(`Wave ${this.waveNumber} spawning complete.`);
                if (this.waveSpawnTimer) this.waveSpawnTimer.remove(false);
                this.nextWaveTimer = this.time.delayedCall(this.timeBetweenWaves, this.startNextWave, [], this);
            } else if (this.isPausedForLevelUp) {
                 console.log(`Wave ${this.waveNumber} spawning paused.`);
                 // Timer will be resumed in resumeAfterLevelUp if needed
            }
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
        // Choose randomly ONLY from the types allowed in the current wave phase
        if (!this.allowedEnemyTypes || this.allowedEnemyTypes.length === 0) {
            console.warn("No allowed enemy types defined for this wave! Defaulting to Ghost.");
            return Ghost; // Fallback
        }

        // --- Weighted Selection within Allowed Types (Example) ---
        let chosenType;
        if (this.allowedEnemyTypes.length === 1) {
            chosenType = this.allowedEnemyTypes[0]; // Only one choice
        } else if (this.allowedEnemyTypes.includes(Plant)) {
            // Phase 3: Ghost (30%), Shadow (40%), Plant (30%)
            const rand = Phaser.Math.Between(1, 10);
            if (rand <= 3) chosenType = Ghost;
            else if (rand <= 7) chosenType = Shadow;
            else chosenType = Plant;
        } else {
            // Phase 2: Ghost (50%), Shadow (50%)
            chosenType = Phaser.Math.RND.pick(this.allowedEnemyTypes); // Simple random pick for phase 2
            // Or weighted:
            // const rand = Phaser.Math.Between(1, 10);
            // chosenType = (rand <= 5) ? Ghost : Shadow;
        }

        // console.log("Chosen enemy type:", chosenType.name); // Optional debug log
        return chosenType;
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
        const enemy = new EnemyClass(this, startX, yPos, this.difficulty);

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

        if (this.pauseKey) this.pauseKey.enabled = false;
        // Hide floating UI
        this.questionText.setVisible(false);
        this.inputText.setVisible(false);


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
                    this.scene.restart({ difficulty: this.difficulty, selectedTables: this.selectedTables });
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
             this.input.enabled = true;
             console.log("Pointer input re-enabled for Game Over buttons.");
        });

    } // End triggerGameOver


    // =============================================
    // --- NEW: EXP and Leveling Methods ---
    // =============================================

    spawnExpDroplet(x, y) {
        // Get a droplet from the pool or create a new one
        const droplet = this.expDroplets.get(x, y); // Uses the classType defined in the group
        if (droplet) {
            droplet.setActive(true).setVisible(true);
            droplet.setPosition(x, y); // Ensure position is set correctly
            droplet.body?.reset(x, y); // Reset physics body state if pooling

            // Optional: Add a small visual effect on spawn (e.g., scale tween)
            this.tweens.add({
                targets: droplet,
                scale: { from: 0.3, to: 0.6 }, // Adjust scale as needed
                alpha: { from: 0.5, to: 1.0 },
                duration: 200,
                ease: 'Power1'
            });
            droplet.moveToPlayer(this.wizard); // Make it fly towards the player
        } else {
            console.warn("Could not get ExpDroplet from pool.");
        }
    }

    collectExpDroplet(player, droplet) {
        // Ensure droplet is active before collecting
        if (!droplet.active) {
            return;
        }

        const value = droplet.expValue || 1; // Get value from droplet
        this.gainExp(value);

        // Play sound (using existing coin sound)
        this.sound.play('correctSound', { volume: 0.4, detune: 200 }); // Slightly higher pitch?

        // Disable and hide the droplet (pooling)
        droplet.setActive(false).setVisible(false);
        // Stop its movement immediately
        if (droplet.body) {
            droplet.body.stop();
            droplet.body.enable = false; // Disable physics body until reused
        }
        // Optional: Add a small visual effect on collection (e.g., particle burst at player)
    }

    gainExp(amount) {
        if (this.isGameOver || this.isPausedForLevelUp) return; // Don't gain EXP if paused or game over

        this.currentExp += amount;
        console.log(`Gained ${amount} EXP. Total: ${this.currentExp}/${this.expToNextLevel}`);
        this.updateExpBar(); // Update the visual bar

        // Check for level up (can level up multiple times from one collection)
        while (this.currentExp >= this.expToNextLevel && !this.isPausedForLevelUp) {
             // Check pause flag again in case multiple level ups happen quickly
            this.levelUp();
        }
    }

    updateExpBar() {
        if (!this.expBar || !this.expBarBg || !this.levelText) return; // Check if UI exists

        this.expBar.clear();
        this.expBar.fillStyle(0x00ffff, 1); // Cyan EXP color

        // Calculate percentage, ensuring it's between 0 and 1
        const percentage = Phaser.Math.Clamp(this.currentExp / this.expToNextLevel, 0, 1);
        const barWidth = 180; // Must match the width used in create()
        const barHeight = 18; // Must match height
        const barX = 20; // Must match X
        const barY = 20; // Must match Y
        const currentBarWidth = barWidth * percentage;

        this.expBar.fillRect(barX, barY, currentBarWidth, barHeight);

        // Update level text as well
        this.levelText.setText(`Level: ${this.playerLevel}`);
    }

    levelUp() {
        // Prevent level up if already paused (e.g., from a previous level up this frame)
        if (this.isPausedForLevelUp) return;

        this.currentExp -= this.expToNextLevel; // Subtract cost, keep remainder
        this.playerLevel++;

        // Increase EXP requirement for the *next* level
        // Example: Needs 3, then 3+4=7, then 7+5=12, then 12+6=18 etc.
        this.expToNextLevel += (this.playerLevel + 1);

        console.log(`%cLEVEL UP! Reached Level ${this.playerLevel}. Next level at ${this.expToNextLevel} EXP. Remainder: ${this.currentExp}`, 'color: yellow; font-weight: bold;');

        this.updateExpBar(); // Update bar with new values (shows remainder EXP)

        // --- Trigger Level Up Screen ---
        this.pauseForLevelUp();
        this.showLevelUpScreen();

        // Optional: Add visual/audio feedback for level up (flash, sound)
        // this.sound.play('levelUpSound'); // Add sound when available
        this.cameras.main.flash(250, 255, 255, 0); // White flash
    }

    // =============================================
    // --- NEW: Pause and Level Up Screen Methods ---
    // =============================================

    pauseForLevelUp() {
        if (this.isPausedForLevelUp) return; // Already paused

        console.log("Pausing game for Level Up selection.");
        this.isPausedForLevelUp = true;
        // Disable manual pause while level up screen is shown
        if (this.isPaused) {
            this.resumeGame(); // Ensure manual pause is undone if active
        }

        // Pause physics simulation
        this.physics.world.pause();

        // Pause wave timers explicitly
        if (this.waveSpawnTimer) this.waveSpawnTimer.paused = true;
        if (this.nextWaveTimer) this.nextWaveTimer.paused = true;

        // Pause individual enemies
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active && typeof enemy.pause === 'function') {
                enemy.pause();
            }
        });

        // Pause projectiles/droplets movement
        this.expDroplets.getChildren().forEach(d => d.body?.stop());
        // this.fireballs.getChildren().forEach(f => f.body?.stop()); // REMOVED

        // Pause player animations
        this.wizard.anims.pause();
    }

    resumeAfterLevelUp() {
        if (!this.isPausedForLevelUp) return; // Not paused

        console.log("Resuming game after Level Up selection.");
        this.isPausedForLevelUp = false;
        // Resume physics simulation (manual pause state remains false)
        this.physics.world.resume();

        // Resume wave timers
        if (this.waveSpawnTimer) this.waveSpawnTimer.paused = false;
        if (this.nextWaveTimer) this.nextWaveTimer.paused = false;

        // Resume individual enemies
        this.enemies.getChildren().forEach(enemy => {
            if (enemy.active && typeof enemy.resume === 'function') {
                enemy.resume();
            }
        });

         // Resume projectiles/droplets movement
         this.expDroplets.getChildren().forEach(droplet => {
             if (droplet.active) {
                 // Restart movement towards player if it hasn't reached yet
                 this.physics.moveToObject(droplet, this.wizard, droplet.moveSpeed);
             }
         });
         // Fireball resume logic REMOVED

         // Resume player animation
         this.wizard.anims.resume();
         // Ensure idle animation plays if nothing else is overriding it
         if (this.wizard.anims.currentAnim?.key !== 'wizard_cast') {
             this.wizard.play('wizard_idle', true);
         }
    }

    createLevelUpScreen() {
        // Create container but keep it hidden
        this.levelUpContainer = this.add.container(this.cameras.main.width / 2, this.cameras.main.height / 2)
            .setDepth(20) // Ensure it's on top of everything
            .setVisible(false);

        // Background panel using graphics
        const bg = this.add.graphics()
            .fillStyle(0x111144, 0.9) // Dark blue, mostly opaque
            .fillRoundedRect(-250, -180, 500, 360, 15) // Centered rectangle
            .lineStyle(3, 0xeeeeff, 1)
            .strokeRoundedRect(-250, -180, 500, 360, 15);

        // Title
        const title = this.add.text(0, -140, 'Level Up!', {
            fontSize: '40px', fill: '#FFD700', fontStyle: 'bold', stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5);

        // --- Upgrade Option Buttons ---
        const buttonStyle = {
            fontSize: '24px', fill: '#fff', backgroundColor: '#00008B', // Dark blue background
            padding: { x: 15, y: 10 },
            fixedWidth: 350, // Ensure buttons have same width
            align: 'center',
            fontStyle: 'bold'
        };
        const buttonHoverStyle = { fill: '#add8e6' }; // Light blue on hover

        // Fireball Button REMOVED

        // Ice Spell Button - Position adjusted to center vertically
        const iceButton = this.add.text(0, 0, '', buttonStyle) // Centered Y
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        iceButton.on('pointerdown', () => this.selectUpgrade('ice'));
        iceButton.on('pointerover', () => iceButton.setStyle(buttonHoverStyle));
        iceButton.on('pointerout', () => iceButton.setStyle({ fill: '#fff' })); // Reset color

        // Add elements to the container
        this.levelUpContainer.add([bg, title, iceButton]); // Only add ice button

        // Store references to buttons for easy text updates
        // this.levelUpContainer.setData('fireballButton', fireballButton); // REMOVED
        this.levelUpContainer.setData('iceButton', iceButton);
    }

    showLevelUpScreen() {
        if (!this.levelUpContainer) return;

        // const fireballButton = this.levelUpContainer.getData('fireballButton'); // REMOVED
        const iceButton = this.levelUpContainer.getData('iceButton');

        // Update button text based on current spell levels
        // const fbLevel = this.spells.fireball.level; // REMOVED
        const iceLevel = this.spells.ice.level;

        // const fbDesc = ` (CD: ${this.spells.fireball.cooldown/1000}s, Dmg: ${this.spells.fireball.damage})`; // REMOVED
        const iceDesc = ` (CD: ${this.spells.ice.cooldown/1000}s, Dur: ${this.spells.ice.duration/1000}s)`;

        // fireballButton.setText(fbLevel === 0 ? 'Learn Fireball' : `Upgrade Fireball (Lvl ${fbLevel + 1})` + fbDesc); // REMOVED
        iceButton.setText(iceLevel === 0 ? 'Learn Ice Spell' : `Upgrade Ice Spell (Lvl ${iceLevel + 1})` + iceDesc);

        this.levelUpContainer.setVisible(true);
        // Optional: Add a tween animation for appearing
        this.levelUpContainer.setScale(0.8).setAlpha(0.5);
        this.tweens.add({
            targets: this.levelUpContainer,
            scale: 1.0,
            alpha: 1.0,
            duration: 200,
            ease: 'Back.easeOut' // A little bounce effect
        });
    }

    selectUpgrade(spellKey) {
        // Ensure screen is visible and game is paused before selecting
        // Also ensure only 'ice' spell can be selected now
        if (spellKey !== 'ice' || !this.spells[spellKey] || !this.isPausedForLevelUp || !this.levelUpContainer.visible) return;

        this.spells[spellKey].level++; // Increment level
        console.log(`Selected upgrade: ${spellKey}, now level ${this.spells[spellKey].level}`);

        // Apply the actual upgrade effects
        this.applySpellUpgrade(spellKey);

        // Hide the screen and resume game
        this.levelUpContainer.setVisible(false);
        this.resumeAfterLevelUp();
    }

    applySpellUpgrade(spellKey) {
        const spell = this.spells[spellKey];
        if (!spell) return;

        const level = spell.level; // Current level *after* incrementing

        // Apply upgrades based on the new level
        if (spellKey === 'ice') {
            // Example: Reduce cooldown, increase duration
            spell.cooldown = Math.max(2000, 9000 - (level * 1000)); // Faster cooldown per level (min 2s)
            spell.duration = 3000 + (level * 750); // Longer freeze per level - INCREASED DURATION PER LEVEL
            console.log(`Ice Spell upgraded: Cooldown ${spell.cooldown}ms, Duration ${spell.duration}ms`);
        }

        // Update UI immediately after upgrade to show the icon if just learned
        this.updateSpellCooldownUI(this.time.now);
    }


    // =============================================
    // --- NEW: Spell Casting Methods ---
    // =============================================

    // castFireball, checkFireballHitEnemy, hitEnemyWithFireball REMOVED

    castIceSpell(time) {
        console.log("Casting Ice Spell!");
        this.spells.ice.lastCast = time; // Record cast time
        // this.sound.play('iceSound'); // Play specific ice sound when available

        // --- NEW: Update Cooldown UI immediately ---
        this.updateSpellCooldownUI(time);

        // Play wizard cast animation
        this.wizard.play('wizard_cast', true);

        const freezeDuration = this.spells.ice.duration;

        // Visual effect: Screen flash blue + temporary frost overlay?
        this.cameras.main.flash(150, 100, 150, 255); // Blue-ish flash
        const frost = this.add.graphics()
            .fillStyle(0xadd8e6, 0.2) // Light blue, semi-transparent
            .fillRect(0, 0, this.cameras.main.width, this.cameras.main.height)
            .setDepth(15); // High depth
        this.time.delayedCall(300, () => frost.destroy()); // Remove frost effect


        // Apply freeze to all active enemies
        this.enemies.getChildren().forEach(enemy => {
            // Check enemy is active and has the freeze method
            if (enemy.active && typeof enemy.freeze === 'function') {
                enemy.freeze(freezeDuration);
            }
        });
    }


    // =============================================
    // --- NEW: Spell Cooldown UI Methods ---
    // =============================================

    createSpellCooldownUI() {
        const iconSize = 50;
        const padding = 15;
        const startY = 60; // Below EXP bar
        const iconX = padding + iconSize / 2;

        // Fireball Icon REMOVED

        // --- Ice Icon ---
        // Position adjusted to where Fireball icon was
        this.iceCooldownIcon = this.add.container(iconX, startY).setDepth(5).setVisible(false);
        const iceBg = this.add.graphics().fillStyle(0x00008B, 0.7).fillCircle(0, 0, iconSize / 2); // Dark blue background
        // Placeholder graphics for ice icon
        const iceIconGraphics = this.add.graphics()
            .fillStyle(0xadd8e6) // Light blue
            .fillCircle(0, 0, iconSize * 0.35) // Smaller inner circle
            .lineStyle(2, 0xffffff)
            .strokeCircle(0, 0, iconSize * 0.35);
        const iceMaskShape = this.make.graphics();
        this.iceCooldownIcon.add([iceBg, iceIconGraphics, iceMaskShape]);
        this.iceCooldownIcon.setData('mask', iceMaskShape);
        iceIconGraphics.mask = new Phaser.Display.Masks.GeometryMask(this, iceMaskShape);
        iceIconGraphics.mask.invertAlpha = true;

        // Initial update
        this.updateSpellCooldownUI(this.time.now);
    }

    updateSpellCooldownUI(time) {
        const iconSize = 50;

        // Fireball UI update REMOVED

        // --- Ice ---
        const iceSpell = this.spells.ice;
        if (iceSpell.level > 0) {
            this.iceCooldownIcon.setVisible(true);
            const elapsed = time - iceSpell.lastCast;
            const progress = Phaser.Math.Clamp(elapsed / iceSpell.cooldown, 0, 1);
            const mask = this.iceCooldownIcon.getData('mask');
            mask.clear();
            if (progress < 1) {
                mask.fillStyle(0xffffff);
                mask.slice(0, 0, iconSize / 2, Phaser.Math.DegToRad(270), Phaser.Math.DegToRad(270 + (1 - progress) * 360), true);
                mask.fillPath();
            }
        } else {
            this.iceCooldownIcon.setVisible(false);
        }
    }


    // =============================================
    // --- NEW: Manual Pause Methods ---
    // =============================================

    togglePause() {
        if (this.isPaused) {
            this.resumeGame();
        } else {
            // Do not allow pausing if level up screen is active
            if (!this.isPausedForLevelUp) {
                this.pauseGame();
            }
        }
    }

    pauseGame() {
        if (this.isPaused || this.isPausedForLevelUp || this.isGameOver) return; // Prevent pausing if already paused/leveling/game over

        console.log("Game Paused Manually");
        this.isPaused = true;
        this.pauseText.setVisible(true);
        // Hide calculation UI
        this.questionText.setVisible(false);
        this.inputText.setVisible(false);

        // Pause physics
        this.physics.world.pause();

        // Pause timers
        if (this.waveSpawnTimer) this.waveSpawnTimer.paused = true;
        if (this.nextWaveTimer) this.nextWaveTimer.paused = true;
        if (this.invulnerableTimer) this.invulnerableTimer.paused = true; // Pause invulnerability timer

        // Pause animations/movement for player and enemies
        this.wizard.anims?.pause();
        this.enemies.getChildren().forEach(enemy => enemy.pause()); // Use existing pause method
        this.expDroplets.getChildren().forEach(d => d.body?.stop());
        // this.fireballs.getChildren().forEach(f => f.body?.stop()); // REMOVED

        // Optional: Lower music volume
        const music = this.sound.get('gameMusic');
        if (music?.isPlaying) {
            music.setVolume(0.1); // Lower volume significantly
        }
    }

    resumeGame() {
        if (!this.isPaused || this.isPausedForLevelUp || this.isGameOver) return; // Prevent resuming if not paused or leveling/game over

        console.log("Game Resumed Manually");
        this.isPaused = false;
        this.pauseText.setVisible(false);
        // Show calculation UI
        this.questionText.setVisible(true);
        this.inputText.setVisible(true);

        // Resume physics
        this.physics.world.resume();

        // Resume timers
        if (this.waveSpawnTimer) this.waveSpawnTimer.paused = false;
        if (this.nextWaveTimer) this.nextWaveTimer.paused = false;
        if (this.invulnerableTimer) this.invulnerableTimer.paused = false; // Resume invulnerability timer

        // Resume animations/movement
        this.wizard.anims?.resume();
        this.enemies.getChildren().forEach(enemy => enemy.resume()); // Use existing resume method
        // Restart movement for droplets
        this.expDroplets.getChildren().forEach(droplet => {
             if (droplet.active) this.physics.moveToObject(droplet, this.wizard, droplet.moveSpeed);
         });
         // Fireball resume logic REMOVED

        // Optional: Restore music volume
        const music = this.sound.get('gameMusic');
        if (music?.isPlaying) {
            music.setVolume(0.4); // Restore original volume
        }
    }


    // =============================================
    // --- NEW: Floating UI Update Method ---
    // =============================================
    updateFloatingUI() {
        if (this.currentTargetEnemy && this.currentTargetEnemy.active) {
            // Calculate position above the enemy's physics body top
            const targetX = this.currentTargetEnemy.x;
            const targetY = this.currentTargetEnemy.body.top; // Use physics body top

            // Position question text above the enemy
            this.questionText.setPosition(targetX, targetY - 35); // Adjust Y offset as needed
            // Position input text below question text
            this.inputText.setPosition(targetX, targetY - 5);   // Adjust Y offset as needed

            // Ensure they are visible if there's an active target
            if (!this.questionText.visible) this.questionText.setVisible(true);
            if (!this.inputText.visible) this.inputText.setVisible(true);

        } else if (this.currentTargetEnemy && !this.currentTargetEnemy.active) {
            // Target became inactive (destroyed by something else?)
            console.log("Current target became inactive, finding new target.");
            this.currentTargetEnemy = null;
            this.questionText.setVisible(false);
            this.inputText.setVisible(false);
            this.generateQuestion(); // Immediately try to find a new target

        } else {
            // No current target
            if (this.questionText.visible) this.questionText.setVisible(false);
            if (this.inputText.visible) this.inputText.setVisible(false);

            // If no target, try to generate one if enemies are present
            if (this.enemies.countActive(true) > 0) {
                 // Add a small delay before trying to generate again to avoid spamming
                 if (!this.findTargetTimer || !this.findTargetTimer.getProgress() < 1) {
                      this.findTargetTimer = this.time.delayedCall(500, this.generateQuestion, [], this);
                 }
            }
        }
    }


} // End Class
