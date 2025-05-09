import Enemy from './Enemy.js';

export default class Shadow extends Enemy {
    constructor(scene, x, y, difficulty) {
        const config = {
            hitPoints: 1,
            moveSpeed: 80 * difficulty, // Faster than Ghost
            isLoner: true, // Does not spawn in groups easily
            animationKey: 'shadow_idle',
            scale: 2.0
        };
        // Use frame 0 from 'enemies' spritesheet as default frame
        super(scene, x, y, 'enemies', 0, config);
    }

    // Override methods if Shadow has unique behavior
}
