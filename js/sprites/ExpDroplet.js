export default class ExpDroplet extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'exp_droplet'); // Use the asset key loaded in BootScene

        scene.physics.world.enable(this);
        scene.add.existing(this);

        this.expValue = 1; // How much EXP this droplet is worth
        this.moveSpeed = 250; // How fast it moves towards the player

        // Optional: Adjust scale if the asset is too big/small
        // this.setScale(0.5);

        // Make collision body smaller/circular if needed
        this.body.setCircle(this.width * 0.4);
        this.body.allowGravity = false; // Doesn't fall
    }

    // Method to make the droplet fly towards the player
    moveToPlayer(player) {
        if (!player || !player.active) {
            // Player might be destroyed or inactive, just destroy the droplet
            console.warn("ExpDroplet: Player not found or inactive, destroying droplet.");
            this.destroy();
            return;
        }
        // Use Arcade Physics' moveToObject function
        this.scene.physics.moveToObject(this, player, this.moveSpeed);
    }

    // Using Arcade Physics overlap, we don't strictly need preUpdate here
    // but it can be useful for cleanup if droplets go way off-screen.
    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        // Example: Destroy if it goes way off screen vertically
        if (this.y < -100 || this.y > this.scene.cameras.main.height + 100 || this.x < -100 || this.x > this.scene.cameras.main.width + 100) {
            console.log("ExpDroplet off-screen, destroying.");
            this.setActive(false).setVisible(false); // Pool it instead of destroy
            this.body?.stop(); // Stop physics if pooling
            // this.destroy(); // Use if not pooling
        }
    }
}
