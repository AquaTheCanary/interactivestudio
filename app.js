document.addEventListener('DOMContentLoaded', () => {
    // Dropdown toggle for native app downloads (.EXE, .DMG, .APK)
    const downloadMenuBtn = document.getElementById('download-menu-btn');
    const downloadDropdown = document.getElementById('download-dropdown');

    downloadMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        downloadDropdown.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        downloadDropdown.classList.remove('show');
    });

    // Interactive Trigger button inside slide
    const triggerBtn = document.getElementById('interactive-trigger');
    const statusText = document.getElementById('trigger-status');
    let triggerCount = 0;

    triggerBtn.addEventListener('click', () => {
        triggerCount++;
        statusText.textContent = `Interactive event fired (${triggerCount} times)`;
        statusText.style.color = '#0066ff';
    });

    // Background color picker for slide
    const bgPicker = document.getElementById('bg-picker');
    const activeSlide = document.getElementById('active-slide');
    const hexLabel = document.getElementById('color-hex-label');

    bgPicker.addEventListener('input', (e) => {
        activeSlide.style.backgroundColor = e.target.value;
        hexLabel.textContent = e.target.value.toUpperCase();
    });

    // IS Theme bubbles listener
    const themeBubbles = document.querySelectorAll('.bubble');
    themeBubbles.forEach(bubble => {
        bubble.addEventListener('click', () => {
            const color = bubble.getAttribute('data-color');
            triggerBtn.style.backgroundColor = color;
            if(color === '#88ff00' || color === '#00f0ff') {
                triggerBtn.style.color = '#000';
            } else {
                triggerBtn.style.color = '#fff';
            }
        });
    });
});
