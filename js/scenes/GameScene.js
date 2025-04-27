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
        this.sessionStats = []; // Array to store stats
        this.questionStartTime = 0; // Timestamp for question timing

        // --- NEW: Leveling System ---
        this.playerLevel = 1;
        this.currentExp = 0;
        this.expToNextLevel = 3; // Initial EXP needed for level 2

        // --- NEW: Spell System ---
        this.spells = {
            fireball: {
                level: 0, // 0 = not learned
                cooldown: 3000, // ms
                lastCast: 0,
                damage: 1 // Base damage
            },
            ice: {
                level: 0,
                cooldown: 8000,
                lastCast: 0,
                duration: 3000 // ms freeze duration - INCREASED BASE DURATION
            }
        };
        this.spellKey = null; // To store the keyboard key for spells
        this.fireballCooldownIcon = null; // NEW: UI for fireball cooldown
        this.iceCooldownIcon = null;      // NEW: UI for ice cooldown
        this.pauseKey = null; // Key for manual pause

        // --- NEW: Physics Groups ---
        this.expDroplets = null; // Group for EXP droplets
        this.fireballs = null; // Group for fireball projectiles
        this.allowedEnemyTypes = []; // NEW: Tracks enemies allowed in the current wave
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
        this.spells.fireball.level = 0;
        this.spells.fireball.lastCast = 0;
        this.spells.fireball.damage = 1; // Reset damage too
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
        this.fireballs = this.physics.add.group({
            classType: Phaser.Physics.Arcade.Sprite, // Basic sprites for now
            runChildUpdate: true,
            allowGravity: false,
            maxSize: 10 // Limit number of active fireballs (optional pooling)
        });


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
        const initialSpawnDelay = 3000; // Time before the very first wave starts
        this.nextWaveTimer = this.time.delayedCall(initialSpawnDelay, this.startNextWave, [], this);
        console.log(`First wave scheduled in ${initialSpawnDelay / 1000}s`);

        // --- NEW: Collisions / Overlaps ---
        this.physics.add.overlap(this.wizard, this.expDroplets, this.collectExpDroplet, null, this);
        this.physics.add.overlap(this.fireballs, this.enemies, this.hitEnemyWithFireball, this.checkFireballHitEnemy, this); // Added processCallback

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
            // Try casting Fireball first if learned and ready
            if (this.spells.fireball.level > 0 && time > this.spells.fireball.lastCast + this.spells.fireball.cooldown) {
                this.castFireball(time);
            }
            // Else try casting Ice if learned and ready
            else if (this.spells.ice.level > 0 && time > this.spells.ice.lastCast + this.spells.ice.cooldown) {
                this.castIceSpell(time);
            }
            // Add else if for other potential spells later
        }

        // --- NEW: Update Fireballs (e.g., remove if off-screen) ---
        // Handled by fireball's own update or preUpdate if it had one.
        // Alternatively, check here:
        this.fireballs.getChildren().forEach(fireball => {
            if (fireball.active && fireball.x > this.cameras.main.width + 50) { // If it goes way off right
                console.log("Fireball off-screen, disabling.");
                fireball.setActive(false).setVisible(false); // Pool it
                fireball.body?.stop();
                // fireball.destroy(); // Use if not pooling
            }
        });

        // --- NEW: Update Spell Cooldown UI ---
        this.updateSpellCooldownUI(time);
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

            // --- Create Lightning Effect ---
            // --- Create Lightning Effect ---
            // Estimate wand position (adjust offsets as needed)
            const wandX = this.wizard.x + 20; // Slightly right of wizard center
            const wandY = this.wizard.y - 60; // Above wizard center (adjust based on sprite)

            // Calculate target position based on enemy's visual center
            const bounds = closestEnemy.getBounds();
            const targetX = bounds.centerX;
            // Add slight vertical jitter to the target point
            const targetY = bounds.centerY + Phaser.Math.Between(-10, 10);

            this.createLightning(wandX, wandY, targetX, targetY);


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
            this.enemiesPerWave = 1 + Math.floor(this.waveNumber / 2); // 1, 1, 2, 2
            this.timeBetweenWaves = Phaser.Math.Between(13000, 15000); // Long breaks (13-15s)
            this.timeBetweenEnemiesInWave = 1500; // Slower spawns within wave
            console.log(`--- Phase 1 (Wave ${this.waveNumber}) ---`);

        } else if (this.waveNumber <= phase2EndWave) {
            // Phase 2: Ghosts & Shadows, Introduce Speed
            this.allowedEnemyTypes = [Ghost, Shadow];
            // Start at 2, increase slowly
            this.enemiesPerWave = 2 + Math.floor((this.waveNumber - phase1EndWave) / 2); // 2, 2, 3, 3, 4
            this.timeBetweenWaves = Math.max(this.minTimeBetweenWaves + 2000, 12000 - (this.waveNumber - phase1EndWave) * 400); // Decrease faster (12s -> ~10s)
            this.timeBetweenEnemiesInWave = 1200; // Slightly faster spawns
            console.log(`--- Phase 2 (Wave ${this.waveNumber}) ---`);

        } else {
            // Phase 3: All Enemies, Introduce Toughness
            this.allowedEnemyTypes = [Ghost, Shadow, Plant];
            // Start at 3, increase steadily
            this.enemiesPerWave = 3 + Math.floor((this.waveNumber - phase2EndWave) / 2); // 3, 3, 4, 4, 5...
            this.timeBetweenWaves = Math.max(this.minTimeBetweenWaves, 9000 - (this.waveNumber - phase2EndWave) * 300); // Decrease towards min (9s -> 3s)
            this.timeBetweenEnemiesInWave = 1000; // Standard spawn speed
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
        // Remove pause key listener too
        if (this.pauseKey) this.pauseKey.enabled = false;


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
        this.fireballs.getChildren().forEach(f => f.body?.stop());

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
         this.fireballs.getChildren().forEach(fireball => {
             if (fireball.active) {
                 // Reapply velocity if it was stopped
                 // Assuming simple rightward movement for now
                 fireball.body.velocity.x = 450; // Use the speed defined in castFireball
             }
         });

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

        // Fireball Button
        const fireballButton = this.add.text(0, -50, '', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        fireballButton.on('pointerdown', () => this.selectUpgrade('fireball'));
        fireballButton.on('pointerover', () => fireballButton.setStyle(buttonHoverStyle));
        fireballButton.on('pointerout', () => fireballButton.setStyle({ fill: '#fff' })); // Reset color

        // Ice Spell Button
        const iceButton = this.add.text(0, 30, '', buttonStyle)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        iceButton.on('pointerdown', () => this.selectUpgrade('ice'));
        iceButton.on('pointerover', () => iceButton.setStyle(buttonHoverStyle));
        iceButton.on('pointerout', () => iceButton.setStyle({ fill: '#fff' })); // Reset color

        // Add elements to the container
        this.levelUpContainer.add([bg, title, fireballButton, iceButton]);

        // Store references to buttons for easy text updates
        this.levelUpContainer.setData('fireballButton', fireballButton);
        this.levelUpContainer.setData('iceButton', iceButton);
    }

    showLevelUpScreen() {
        if (!this.levelUpContainer) return;

        const fireballButton = this.levelUpContainer.getData('fireballButton');
        const iceButton = this.levelUpContainer.getData('iceButton');

        // Update button text based on current spell levels
        const fbLevel = this.spells.fireball.level;
        const iceLevel = this.spells.ice.level;

        const fbDesc = ` (CD: ${this.spells.fireball.cooldown/1000}s, Dmg: ${this.spells.fireball.damage})`;
        const iceDesc = ` (CD: ${this.spells.ice.cooldown/1000}s, Dur: ${this.spells.ice.duration/1000}s)`;

        fireballButton.setText(fbLevel === 0 ? 'Learn Fireball' : `Upgrade Fireball (Lvl ${fbLevel + 1})` + fbDesc);
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
        if (!this.spells[spellKey] || !this.isPausedForLevelUp || !this.levelUpContainer.visible) return;

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
        if (spellKey === 'fireball') {
            // Example: Reduce cooldown, increase damage
            spell.cooldown = Math.max(500, 3500 - (level * 500)); // Faster cooldown per level (min 0.5s)
            spell.damage = 1 + Math.floor(level / 2); // Increase damage every 2 levels
            console.log(`Fireball upgraded: Cooldown ${spell.cooldown}ms, Damage ${spell.damage}`);
        } else if (spellKey === 'ice') {
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

    castFireball(time) {
        console.log("Casting Fireball!");
        this.spells.fireball.lastCast = time; // Record cast time for cooldown
        this.sound.play('castSound', { volume: 0.7 }); // Reuse cast sound

        // --- NEW: Update Cooldown UI immediately ---
        this.updateSpellCooldownUI(time);

        // Play wizard cast animation (if not already playing)
        this.wizard.play('wizard_cast', true); // Force restart

        // Create fireball sprite from the wizard's wand position
        const wandX = this.wizard.x + 25; // Adjust offset based on wizard sprite
        const wandY = this.wizard.y - 65; // Adjust offset
        const fireballSpeed = 450; // Pixels per second

        // Get a fireball from the pool
        const fireball = this.fireballs.get(wandX, wandY, 'fireball');
        if (fireball) {
            fireball.setActive(true).setVisible(true);
            fireball.setPosition(wandX, wandY); // Ensure position
            fireball.setScale(1.2); // Make it slightly larger?
            fireball.setTint(0xffddaa); // Orangey tint
            fireball.setData('damage', this.spells.fireball.damage); // Store current damage
            fireball.setDepth(this.wizard.depth - 1); // Appear behind wizard initially? Or above?

            // Enable physics body if reusing from pool
            fireball.body?.setEnable(true);
            fireball.body?.reset(wandX, wandY);
            fireball.body?.setSize(fireball.width * 0.6, fireball.height * 0.6); // Adjust collision shape if needed

            // Simple targeting: Aim straight right
            fireball.setVelocityX(fireballSpeed);
            fireball.setVelocityY(0);

            // Optional: Add particle trail?
        } else {
            console.warn("Fireball pool empty or failed to create.");
        }
    }

    // Process callback for fireball/enemy overlap
    checkFireballHitEnemy(fireball, enemy) {
        // Only allow active fireballs to hit active, non-frozen enemies
        return fireball.active && enemy.active && !enemy.isFrozen;
    }

    hitEnemyWithFireball(fireball, enemy) {
        // Double check active state here just in case processCallback fails somehow
        if (!fireball.active || !enemy.active) {
            return;
        }

        console.log(`Fireball hit ${enemy.constructor.name}`);
        const damage = fireball.getData('damage') || 1;

        // Play hit sound
        this.sound.play('enemyHitSound', { volume: 0.6 }); // Reuse explosion sound

        // Apply damage to the enemy
        const defeated = enemy.takeDamage(damage); // Enemy handles its own death/effects

        // Optional: Create a small explosion effect at the impact point using graphics
        const explosion = this.add.graphics({ x: fireball.x, y: fireball.y });
        explosion.fillStyle(0xffaa00, 0.8);
        explosion.fillCircle(0, 0, 10);
        this.tweens.add({
            targets: explosion,
            scale: 3,
            alpha: 0,
            duration: 150,
            onComplete: () => explosion.destroy()
        });


        // Disable the fireball (pool it)
        fireball.setActive(false).setVisible(false);
        fireball.body?.stop();
        fireball.body?.setEnable(false);
    }

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

        // --- Fireball Icon ---
        this.fireballCooldownIcon = this.add.container(iconX, startY).setDepth(5).setVisible(false);
        const fbBg = this.add.graphics().fillStyle(0x8B0000, 0.7).fillCircle(0, 0, iconSize / 2); // Dark red background
        const fbIcon = this.add.sprite(0, 0, 'fireball').setScale(iconSize / this.textures.get('fireball').getSourceImage().width * 0.8); // Scale fireball sprite to fit
        const fbMaskShape = this.make.graphics(); // Mask to show cooldown
        this.fireballCooldownIcon.add([fbBg, fbIcon, fbMaskShape]);
        this.fireballCooldownIcon.setData('mask', fbMaskShape);
        fbIcon.mask = new Phaser.Display.Masks.GeometryMask(this, fbMaskShape);
        fbIcon.mask.invertAlpha = true; // Reveal part covered by mask

        // --- Ice Icon ---
        const iceY = startY + iconSize + padding;
        this.iceCooldownIcon = this.add.container(iconX, iceY).setDepth(5).setVisible(false);
        const iceBg = this.add.graphics().fillStyle(0x00008B, 0.7).fillCircle(0, 0, iconSize / 2); // Dark blue background
        // Placeholder graphics for ice icon until we have an asset
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

        // --- Fireball ---
        const fbSpell = this.spells.fireball;
        if (fbSpell.level > 0) {
            this.fireballCooldownIcon.setVisible(true);
            const elapsed = time - fbSpell.lastCast;
            const progress = Phaser.Math.Clamp(elapsed / fbSpell.cooldown, 0, 1); // 0 = full cooldown, 1 = ready
            const mask = this.fireballCooldownIcon.getData('mask');
            mask.clear();
            if (progress < 1) {
                mask.fillStyle(0xffffff);
                // Draw a pie shape representing the remaining cooldown
                mask.slice(0, 0, iconSize / 2, Phaser.Math.DegToRad(270), Phaser.Math.DegToRad(270 + (1 - progress) * 360), true);
                mask.fillPath();
            }
        } else {
            this.fireballCooldownIcon.setVisible(false);
        }

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
        this.fireballs.getChildren().forEach(f => f.body?.stop());

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
        // Restart movement for droplets/fireballs
        this.expDroplets.getChildren().forEach(droplet => {
             if (droplet.active) this.physics.moveToObject(droplet, this.wizard, droplet.moveSpeed);
         });
         this.fireballs.getChildren().forEach(fireball => {
             if (fireball.active) fireball.body.velocity.x = 450; // Reapply velocity
         });

        // Optional: Restore music volume
        const music = this.sound.get('gameMusic');
        if (music?.isPlaying) {
            music.setVolume(0.4); // Restore original volume
        }
    }

} // End Class
