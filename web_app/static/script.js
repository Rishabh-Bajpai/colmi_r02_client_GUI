document.addEventListener('DOMContentLoaded', () => {
    const apiKeyInput = document.getElementById('api-key');
    const showApiKeyBtn = document.getElementById('show-api-key-btn');
    const apiStatus = document.getElementById('api-status');
    const scanBtn = document.getElementById('scan-btn');
    const deviceSelect = document.getElementById('device-select');
    const deviceControls = document.getElementById('device-controls');
    const selectedDeviceTitle = document.getElementById('selected-device');

    let selectedAddress = null;
    let hrChart = null;
    let stepsChart = null;

    // --- API Request Function ---
    const makeRequest = async (url, options) => {
        const response = await fetch(url, options);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'An unknown error occurred' }));
            throw new Error(error.detail);
        }
        const text = await response.text();
        return text ? JSON.parse(text) : {};
    };

    const getHeaders = () => {
        return {
            'Content-Type': 'application/json',
            'X-API-Key': apiKeyInput.value
        };
    };

    // --- Initialization ---
    const checkApi = async () => {
        try {
            const data = await makeRequest('/api_key');
            if (data.api_key) {
                apiStatus.textContent = 'API Protection: ON';
                apiStatus.style.color = 'lightgreen';
                if (!apiKeyInput.value) {
                    apiKeyInput.value = data.api_key;
                }
            } else {
                apiStatus.textContent = 'API Protection: OFF';
                apiStatus.style.color = 'orange';
            }
        } catch (e) {
            apiStatus.textContent = 'API Status Unknown';
            apiStatus.style.color = 'red';
        }
    };
    checkApi();

    showApiKeyBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            showApiKeyBtn.textContent = 'Hide';
        } else {
            apiKeyInput.type = 'password';
            showApiKeyBtn.textContent = 'Show';
        }
    });

    // --- Event Listeners ---
    scanBtn.addEventListener('click', async () => {
        scanBtn.disabled = true;
        scanBtn.textContent = 'Scanning...';
        try {
            const devices = await makeRequest('/scan', { headers: getHeaders() });
            deviceSelect.innerHTML = '<option value="">-- Select a device --</option>';
            devices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.address;
                option.textContent = `${device.name || 'Unknown'} (${device.address})`;
                deviceSelect.appendChild(option);
            });
        } catch (error) {
            alert(`Scan failed: ${error.message}`);
        } finally {
            scanBtn.disabled = false;
            scanBtn.textContent = 'Scan';
        }
    });

    deviceSelect.addEventListener('change', () => {
        selectedAddress = deviceSelect.value;
        if (selectedAddress) {
            deviceControls.classList.remove('hidden');
            selectedDeviceTitle.textContent = `Selected Device: ${selectedAddress}`;
        } else {
            deviceControls.classList.add('hidden');
        }
    });

    const infoBtn = document.getElementById('info-btn');
    infoBtn.addEventListener('click', async () => {
        if (!selectedAddress) return;
        const infoDisplay = document.getElementById('info-display');
        const infoOutput = document.getElementById('info-output');
        
        infoBtn.textContent = 'Getting Info...';
        infoBtn.disabled = true;
        infoDisplay.innerHTML = '';
        infoOutput.textContent = '';

        try {
            const data = await makeRequest(`/${selectedAddress}/info`, { headers: getHeaders() });
            infoOutput.textContent = JSON.stringify(data, null, 2);
            infoDisplay.innerHTML = `
                <p><strong>Hardware Version:</strong> ${data.device_info.hw_version}</p>
                <p><strong>Firmware Version:</strong> ${data.device_info.fw_version}</p>
                <p><strong>Battery:</strong> ${data.battery.battery_level}% ${data.battery.charging ? '(Charging)' : ''}</p>
            `;
        } catch (error) {
            alert(`Failed to get device info: ${error.message}`);
        } finally {
            infoBtn.textContent = 'Get Info';
            infoBtn.disabled = false;
        }
    });

    const hrLogBtn = document.getElementById('hr-log-btn');
    hrLogBtn.addEventListener('click', async () => {
        if (!selectedAddress) return;
        const hrLogOutput = document.getElementById('hr-log-output');
        
        hrLogBtn.textContent = 'Getting Log...';
        hrLogBtn.disabled = true;
        hrLogOutput.textContent = '';
        if (hrChart) hrChart.destroy();

        const date = document.getElementById('hr-date').value;
        try {
            const data = await makeRequest(`/${selectedAddress}/heart_rate_log?target_date=${date}`, { headers: getHeaders() });
            hrLogOutput.textContent = JSON.stringify(data.raw, null, 2);

            if (data && data.chart_data) {
                const labels = data.chart_data.map(item => new Date(item[1]).toLocaleTimeString());
                let values = data.chart_data.map(item => item[0]);

                for (let i = 0; i < values.length; i++) {
                    if (values[i] === 0) {
                        let j = i + 1;
                        while (j < values.length && values[j] === 0) j++;
                        if (j < values.length && i > 0 && values[i-1] !== 0) {
                            const start = values[i-1];
                            const end = values[j];
                            const steps = j - (i - 1);
                            for (let k = 1; k < steps; k++) {
                                values[i + k - 1] = start + (end - start) * k / steps;
                            }
                        }
                        i = j - 1;
                    }
                }

                hrChart = new Chart(document.getElementById('hr-chart'), {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Heart Rate',
                            data: values,
                            borderColor: 'rgba(255, 99, 132, 1)',
                            backgroundColor: 'rgba(255, 99, 132, 0.2)',
                            fill: true,
                        }]
                    },
                    options: {
                        scales: { x: { ticks: { color: '#e0e0e0' }, grid: { color: '#444' } }, y: { ticks: { color: '#e0e0e0' }, grid: { color: '#444' } } },
                        plugins: { legend: { labels: { color: '#e0e0e0' } } }
                    }
                });
            }
        } catch (error) {
            alert(`Failed to get heart rate log: ${error.message}`);
        } finally {
            hrLogBtn.textContent = 'Get Log';
            hrLogBtn.disabled = false;
        }
    });

    const setTimeBtn = document.getElementById('set-time-btn');
    setTimeBtn.addEventListener('click', async () => {
        if (!selectedAddress) return;
        setTimeBtn.textContent = 'Setting Time...';
        setTimeBtn.disabled = true;
        const time = new Date(document.getElementById('set-time-input').value).toISOString();
        try {
            await makeRequest(`/${selectedAddress}/time?time=${time}`, { method: 'POST', headers: getHeaders() });
            alert('Time set!');
        } catch (error) {
            alert(`Failed to set time: ${error.message}`);
        } finally {
            setTimeBtn.textContent = 'Set Time';
            setTimeBtn.disabled = false;
        }
    });

    const getHrSettingsBtn = document.getElementById('get-hr-settings-btn');
    getHrSettingsBtn.addEventListener('click', async () => {
        if (!selectedAddress) return;
        const hrSettingsDisplay = document.getElementById('hr-settings-display');
        const getHrSettingsOutput = document.getElementById('get-hr-settings-output');

        getHrSettingsBtn.textContent = 'Getting Settings...';
        getHrSettingsBtn.disabled = true;
        hrSettingsDisplay.innerHTML = '';
        getHrSettingsOutput.textContent = '';

        try {
            const data = await makeRequest(`/${selectedAddress}/heart_rate_log_settings`, { headers: getHeaders() });
            getHrSettingsOutput.textContent = JSON.stringify(data, null, 2);
            hrSettingsDisplay.innerHTML = `
                <p><strong>Enabled:</strong> ${data.enabled}</p>
                <p><strong>Interval:</strong> ${data.interval} minutes</p>
            `;
        } catch (error) {
            alert(`Failed to get heart rate settings: ${error.message}`);
        } finally {
            getHrSettingsBtn.textContent = 'Get Settings';
            getHrSettingsBtn.disabled = false;
        }
    });

    const setHrSettingsBtn = document.getElementById('set-hr-settings-btn');
    setHrSettingsBtn.addEventListener('click', async () => {
        if (!selectedAddress) return;
        setHrSettingsBtn.textContent = 'Setting Settings...';
        setHrSettingsBtn.disabled = true;
        const enabled = document.getElementById('hr-enable').checked;
        const interval = document.getElementById('hr-interval').value;
        try {
            await makeRequest(`/${selectedAddress}/heart_rate_log_settings?enable=${enabled}&interval=${interval}`, { method: 'POST', headers: getHeaders() });
            alert('Heart rate log settings updated!');
        } catch (error) {
            alert(`Failed to set heart rate settings: ${error.message}`);
        } finally {
            setHrSettingsBtn.textContent = 'Set Settings';
            setHrSettingsBtn.disabled = false;
        }
    });

    const realTimeBtn = document.getElementById('real-time-btn');
    realTimeBtn.addEventListener('click', async () => {
        if (!selectedAddress) return;
        const realTimeDisplay = document.getElementById('real-time-display');
        const realTimeOutput = document.getElementById('real-time-output');

        realTimeBtn.textContent = 'Getting Reading...';
        realTimeBtn.disabled = true;
        realTimeDisplay.innerHTML = '';
        realTimeOutput.textContent = '';

        const readingType = document.getElementById('reading-type').value;
        try {
            const data = await makeRequest(`/${selectedAddress}/real_time_reading?reading=${readingType}`, { headers: getHeaders() });
            realTimeOutput.textContent = JSON.stringify(data, null, 2);
            if (data.reading && data.reading.length > 0) {
                const average = data.reading.reduce((a, b) => a + b, 0) / data.reading.length;
                realTimeDisplay.innerHTML = `<p><strong>Average:</strong> ${average.toFixed(2)}</p>`;
            }
        } catch (error) {
            alert(`Failed to get real-time reading: ${error.message}`);
        } finally {
            realTimeBtn.textContent = 'Get Reading';
            realTimeBtn.disabled = false;
        }
    });

    const stepsBtn = document.getElementById('steps-btn');
    stepsBtn.addEventListener('click', async () => {
        if (!selectedAddress) return;
        const stepsSummary = document.getElementById('steps-summary');
        const stepsOutput = document.getElementById('steps-output');

        stepsBtn.textContent = 'Getting Steps...';
        stepsBtn.disabled = true;
        stepsSummary.innerHTML = '';
        stepsOutput.textContent = '';
        if (stepsChart) stepsChart.destroy();

        const date = document.getElementById('steps-date').value;
        try {
            const data = await makeRequest(`/${selectedAddress}/steps?when=${date}`, { headers: getHeaders() });
            stepsOutput.textContent = JSON.stringify(data, null, 2);

            if (Array.isArray(data) && data.length > 0) {
                const totalSteps = data.reduce((sum, item) => sum + item.steps, 0);
                const totalCalories = data.reduce((sum, item) => sum + item.calories, 0);
                const totalDistance = data.reduce((sum, item) => sum + item.distance, 0);
                stepsSummary.innerHTML = `
                    <p><strong>Total Steps:</strong> ${totalSteps}</p>
                    <p><strong>Total Calories:</strong> ${totalCalories}</p>
                    <p><strong>Total Distance:</strong> ${totalDistance}m</p>
                `;
                const labels = data.map(item => {
                    const hour = Math.floor(item.time_index / 4);
                    const minute = (item.time_index % 4) * 15;
                    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
                });
                stepsChart = new Chart(document.getElementById('steps-chart'), {
                    type: 'bar',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Steps',
                            data: data.map(item => item.steps),
                            backgroundColor: 'rgba(54, 162, 235, 0.5)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        scales: { x: { ticks: { color: '#e0e0e0' }, grid: { color: '#444' } }, y: { ticks: { color: '#e0e0e0' }, grid: { color: '#444' } } },
                        plugins: { legend: { labels: { color: '#e0e0e0' } } }
                    }
                });
            }
        } catch (error) {
            alert(`Failed to get steps: ${error.message}`);
        } finally {
            stepsBtn.textContent = 'Get Steps';
            stepsBtn.disabled = false;
        }
    });

    const rebootBtn = document.getElementById('reboot-btn');
    rebootBtn.addEventListener('click', async () => {
        if (!selectedAddress) return;
        if (confirm('Are you sure you want to reboot the device?')) {
            rebootBtn.textContent = 'Rebooting...';
            rebootBtn.disabled = true;
            try {
                await makeRequest(`/${selectedAddress}/reboot`, { method: 'POST', headers: getHeaders() });
                alert('Device rebooted!');
            } catch (error) {
                alert(`Failed to reboot: ${error.message}`);
            } finally {
                rebootBtn.textContent = 'Reboot';
                rebootBtn.disabled = false;
            }
        }
    });
});