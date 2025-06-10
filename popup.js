document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["content.js"]
  });

  chrome.tabs.sendMessage(tab.id, { type: "get_whatsapp_data" }, (response) => {
    if (!response?.success) {
      document.body.innerHTML = `<p>Error: ${response?.error || 'Could not fetch data from WhatsApp. Please ensure web.whatsapp.com is the active tab and reload.'}</p>`;
      return;
    }

    const { groups, participants, contacts } = response.data;
    const groupList = document.getElementById("group-list");
    const exportZipBtn = document.getElementById("export-zip-btn");

    let selectedGroupIds = new Set();

    groups.forEach(group => {
      const groupItem = document.createElement("div");
      groupItem.className = "group-item";
      
      const label = document.createElement("label");
      
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = group.id;
      checkbox.dataset.groupName = group.subject;

      const groupName = document.createElement("span");
      groupName.className = "group-name";
      // FIX: Display a placeholder for groups with no name
      groupName.textContent = group.subject || "Unnamed Group"; 

      label.appendChild(checkbox);
      label.appendChild(groupName);
      groupItem.appendChild(label);
      groupList.appendChild(groupItem);
    });

    groupList.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox') {
            const groupId = event.target.value;
            if (event.target.checked) {
                selectedGroupIds.add(groupId);
            } else {
                selectedGroupIds.delete(groupId);
            }
            exportZipBtn.disabled = selectedGroupIds.size === 0;
        }
    });

    exportZipBtn.onclick = () => {
      if (selectedGroupIds.size === 0) {
        alert("Please select at least one group to export.");
        return;
      }

      const zip = new JSZip();

      selectedGroupIds.forEach(groupId => {
        const group = groups.find(g => g.id === groupId);
        const part = participants.find(p => p.groupId === groupId);

        if (!group || !part) return;

        const participantData = part.participants.map(id => {
          const contact = contacts.find(c => c.phoneNumber === id);
          
          // FIX #1: Add a check to ensure 'id' is a string before calling replace.
          const phoneNumber = (typeof id === 'string') ? id.replace('@c.us', '') : 'INVALID_ID';

          return {
            phoneNumber: phoneNumber,
            name: contact ? contact.pushname : 'Unknown',
            isSaved: contact?.isAddressBookContact ? 'Yes' : 'No'
          };
        });

        if (participantData.length > 0) {
          // FIX #2: Provide a fallback name if group.subject is undefined.
          const groupName = group.subject || `Unknown_Group_${groupId}`;
          const safeFileName = groupName.replace(/[\/:*?"<>|]/g, "_") + ".csv";
          
          const csvContent = generateCSV(participantData);
          zip.file(safeFileName, csvContent);
        }
      });
      
      zip.generateAsync({ type: "blob" }).then(blob => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = "WhatsApp_Groups_Export.zip";
        link.click();
        URL.revokeObjectURL(link.href);
      }).catch(err => {
        console.error("Error creating ZIP file:", err);
        alert("Failed to create ZIP file.");
      });
    };
  });
});

function generateCSV(data) {
  const header = ['Phone Number', 'Name', 'Is Saved'];
  const rows = data.map(row => [
    `"${row.phoneNumber}"`,
    `"${(row.name || '').replace(/"/g, '""')}"`, // Also defend against null/undefined names
    `"${row.isSaved}"`
  ]);

  const csv = [header.join(","), ...rows.map(e => e.join(","))].join("\n");
  return csv;
}