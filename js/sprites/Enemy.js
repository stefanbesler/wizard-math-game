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
        // Optional: Add death effects (explosion, fade out, etc.)
        // For now, just destroy the sprite
        this.destroy();
    }

    // Update method for movement (called by GameScene's update)
    update(delta) {
        // Move left based on speed and delta time
        this.x -= (this.moveSpeed / 1000) * delta;

        // Optional: Despawn if way off-screen
        if (this.x < -100) {
            console.log(`${this.constructor.name} went off-screen, destroying.`);
            this.destroy();
        }
    }
}
