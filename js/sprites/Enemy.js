// Base class for all enemy types
export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture, frame, config) {
        super(scene, x, y, texture, frame);

        // Add to scene's physics and display list
        scene.physics.world.enable(this);
        scene.add.existing(this);

        // Common properties
        this.hitPoints = config.hitPoints || 1;
        this.moveSpeed = config.moveSpeed || 50; // Default speed
        this.isLoner = config.isLoner || false; // Default: can spawn in groups
        this.animationKey = config.animationKey || ''; // Animation to play

        // --- NEW: State Properties ---
        this.isPaused = false;
        this.isFrozen = false;
        this.freezeTimer = null;
        this.originalSpeed = this.moveSpeed; // Store initial speed
        // --- END NEW ---

        // Set sprite properties
        this.setOrigin(0.5, 1); // Bottom-center origin usually
        this.setScale(config.scale || 2.0); // Default scale
        this.setCollideWorldBounds(false); // Allow moving off-screen

        // Start animation if provided
        if (this.animationKey) {
            this.play(this.animationKey);
        }

        console.log(`${this.constructor.name} created with HP: ${this.hitPoints}, Speed: ${this.moveSpeed}`);
    }

    // --- NEW: Pause/Resume Methods ---
    pause() {
        if (this.isPaused) return;
        this.isPaused = true;
        this.anims?.pause(); // Pause animation
        // Stop physics body movement
        this.body?.stop();
        // Clear freeze timer if paused while frozen
        if (this.freezeTimer) this.freezeTimer.paused = true;
    }

    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;
        // Resume animation only if it was previously playing and is now paused
        if (this.anims?.currentAnim && this.anims.isPaused) {
            this.anims.resume();
        }
        // Resume physics body movement (velocity needs to be reset in update)
        // Resume freeze timer if it was paused
        if (this.freezeTimer) this.freezeTimer.paused = false;
    }
    // --- END NEW ---

    // --- NEW: Freeze/Unfreeze Methods ---
    freeze(duration) {
        if (this.isFrozen || !this.active) return; // Don't re-freeze or freeze inactive

        console.log(`${this.constructor.name} frozen for ${duration}ms`);
        this.isFrozen = true;
        this.setTint(0xadd8e6); // Light blue tint
        this.anims?.pause(); // Pause animation
        this.originalSpeed = this.moveSpeed; // Store current speed
        this.moveSpeed = 0; // Stop movement logic in update
        this.body?.stop(); // Also stop physics body directly

        // Clear existing timer before setting a new one
        if (this.freezeTimer) this.freezeTimer.remove();

        // Unfreeze after duration
        this.freezeTimer = this.scene.time.delayedCall(duration, this.unfreeze, [], this);
    }

    unfreeze() {
        if (!this.isFrozen || !this.active) return; // Only unfreeze if currently frozen and active

        console.log(`${this.constructor.name} unfreezing.`);
        this.isFrozen = false;
        this.clearTint();
        // Resume animation only if it was paused by the freeze
        if (this.anims?.currentAnim && this.anims.isPaused) {
             this.anims.resume();
        }
        this.moveSpeed = this.originalSpeed; // Restore speed for update logic
        this.freezeTimer = null; // Clear the timer reference
        // Velocity will be reapplied in the update loop
    }
    // --- END NEW ---


    // Method for taking damage
    takeDamage(amount) {
        this.hitPoints -= amount;
        console.log(`${this.constructor.name} took ${amount} damage, HP remaining: ${this.hitPoints}`);

        // Optional: Add visual feedback (flash red)
        this.scene.tweens.add({
            targets: this,
            alpha: 0.5,
            duration: 100,
            yoyo: true,
            ease: 'Power1',
            onStart: () => this.setTint(0xff0000), // Red tint
            onComplete: () => this.clearTint().setAlpha(1.0) // Clear tint and alpha
        });


        if (this.hitPoints <= 0) {
            this.die();
            return true; // Indicate enemy is defeated
        }
        return false; // Indicate enemy survived
    }

    // Method for handling enemy death
    die() {
        console.log(`${this.constructor.name} defeated.`);

        // --- NEW: Clean up timers and spawn EXP ---
        if (this.freezeTimer) {
            this.freezeTimer.remove(); // Stop timer if frozen on death
            this.freezeTimer = null;
        }

        // Spawn EXP Droplet via GameScene
        if (this.scene && typeof this.scene.spawnExpDroplet === 'function') {
            // Spawn near center
            this.scene.spawnExpDroplet(this.x, this.y - this.height / 2);
        }
        // --- END NEW ---

        // Optional: Add death effects (explosion, fade out, etc.)
        // For now, just destroy the sprite
        this.destroy(); // This also removes it from the physics group
    }

    // Update method for movement (called by GameScene's update)
    update(delta) {
        // --- NEW: Check for pause/freeze states ---
        if (this.isPaused || this.isFrozen || !this.active) {
            // If paused or frozen, ensure the physics body is stopped
            this.body?.stop();
            return; // Skip movement logic
        }
        // --- END NEW ---

        // Ensure velocity reflects current speed (needed after pause/freeze)
        this.body.velocity.x = -this.moveSpeed;

        // Optional: Despawn if way off-screen
        if (this.x < -100) {
            console.log(`${this.constructor.name} went off-screen, destroying.`);
            this.destroy();
        }
    }
}
