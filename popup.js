document.addEventListener("DOMContentLoaded", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
    // Inject content script if not already injected
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"]
    });
  
    // Then send the message
    chrome.tabs.sendMessage(tab.id, { type: "get_whatsapp_data" }, (response) => {
      if (!response?.success) {
        document.body.innerHTML = `<p>Error: ${response?.error || 'Could not fetch data.'}</p>`;
        return;
      }
  
      const { groups, participants, contacts } = response.data;
      const groupList = document.getElementById("group-list");
      const participantInfo = document.getElementById("participant-info");
      const exportBtn = document.getElementById("export-btn");
  
      let currentGroupData = [];
      let currentGroupName = '';
  
      groups.forEach(group => {
        const div = document.createElement("div");
        div.textContent = group.subject;
        div.className = "group";
        div.onclick = () => {
          currentGroupName = group.subject; // Store the group name for use in filename
  
          const part = participants.find(p => p.groupId === group.id);
          if (!part) {
            participantInfo.innerHTML = `<p>No participant info found.</p>`;
            return;
          }
  
          // Map participants to extract the contact info
          currentGroupData = part.participants.map(id => {
            const contact = contacts.find(c => c.phoneNumber === id);
            const name = contact ? contact.pushname : 'Unknown'; // Use pushname for the name
            const phoneNumber = contact ? id.replace('@c.us', '') : 'Unknown'; // Clean phone number
            const isSaved = contact?.isAddressBookContact ? 'Yes' : 'No';
  
            return {
              phoneNumber: phoneNumber,
              name: name,
              isSaved: isSaved
            };
          });
  
          // Hide the participants list (optional, if you don't want to show them in the popup)
          participantInfo.style.display = 'none';
  
          // Show Export CSV Button
          exportBtn.style.display = 'block'; 
          exportBtn.textContent = `Export ${group.subject} to CSV`;
        };
        groupList.appendChild(div);
      });
  
      // Export CSV function
      exportBtn.onclick = () => {
        if (!currentGroupData.length) {
          alert("No participants found to export.");
          return;
        }
        const csvContent = generateCSV(currentGroupData);
        downloadCSV(csvContent, currentGroupName);
      };
    });
  });
  
  // Function to generate CSV content
  function generateCSV(data) {
    const header = ['Phone Number', 'Name', 'Is Saved'];
    const rows = data.map(row => [row.phoneNumber, row.name, row.isSaved]);
  
    // Add header and rows to the CSV content
    const csv = [header, ...rows].map(e => e.join(",")).join("\n");
    return csv;
  }
  
  // Function to trigger CSV file download
  function downloadCSV(csvContent, groupName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const safeGroupName = groupName.replace(/[\/:*?"<>|]/g, "_"); // Clean up group name to be a valid filename
    link.href = URL.createObjectURL(blob);
    link.download = `${safeGroupName}.csv`; // Use group name as part of the filename
    link.click();
  }
  