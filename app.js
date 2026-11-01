document.addEventListener('DOMContentLoaded', () => {
        const interactBtn = document.getElementById('interact-btn');
            const demoHeading = document.getElementById('demo-heading');
                const demoSubtext = document.getElementById('demo-subtext');

                    const colorAccents = ['#88ff00', '#ff00cd', '#00f0ff', '#ff2a4b'];
                        let clickCount = 0;

                            interactBtn.addEventListener('click', () => {
                                    clickCount++;
                                            const nextColor = colorAccents[clickCount % colorAccents.length];
                                                    
                                                            demoHeading.style.color = nextColor;
                                                                    demoHeading.style.textShadow = `0 0 25px ${nextColor}`;
                                                                            demoSubtext.textContent = `Action executed ${clickCount} times!`;
                                                                                });
                                                                                });
})