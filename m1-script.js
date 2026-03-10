document.addEventListener('DOMContentLoaded', () => {
    
    // *** ✅ CONFIG: URL ของ Apps Script ✅ ***
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzxxdb10yR1yBhd7fxUs3e4KN2k4IIMMtRYVW0uT_AO118FVCH34ZKSxff7iTxYk7DI2Q/exec'; 
    
    const seats = document.querySelectorAll('.seat'); 
    const modal = document.getElementById('booking-modal');
    const closeButton = document.querySelector('.close-button');
    const bookingForm = document.getElementById('booking-form');
    const transferDetails = document.getElementById('transfer-details');
    const bookingFormArea = document.getElementById('booking-form-area');
    const nextToFormButton = document.getElementById('next-to-form');
    const backToDetailsButton = document.getElementById('back-to-details');
    const currentDeskInfoStep1 = document.getElementById('current-desk-info-step1');
    const currentDeskInfoStep2 = document.getElementById('current-desk-info-step2');
    
    let selectedSeat = null; 

    // ------------------------------------------------------------------
    // 1. ดึงสถานะที่นั่ง (Real-time)
    // ------------------------------------------------------------------
    const fetchSeatStatus = async () => {
        try {
            const response = await fetch(`${APPS_SCRIPT_URL}?callback=handleResponse`);
            const text = await response.text();
            const jsonString = text.substring(text.indexOf('(') + 1, text.lastIndexOf(')'));
            const data = JSON.parse(jsonString);

            data.forEach(seatData => {
                // หาที่นั่งด้วยรหัส (เช่น A1, A2)
                const seatElement = document.querySelector(`.seat[data-seat-id="${seatData['Seat ID']}"]`);
                if (seatElement) {
                    const status = seatData['Status']; // 'Booked' หรือ 'Available'
                    
                    // ปรับค่าสถานะให้เป็นตัวเล็กเพื่อให้ตรงกับ CSS (.seat[data-status="booked"])
                    const statusLower = status.toLowerCase();
                    seatElement.setAttribute('data-status', statusLower);
                    
                    if (statusLower === 'booked') {
                        seatElement.setAttribute('data-name', seatData['Name']);
                        seatElement.title = `จองแล้วโดย: ${seatData['Name']}`; // แสดงชื่อเมื่อเอาเมาส์วาง
                    } else {
                        seatElement.removeAttribute('data-name');
                        seatElement.title = `ที่นั่ง ${seatData['Seat ID']} ว่าง`;
                    }
                }
            });
        } catch (error) {
            console.error('Error fetching seat status:', error);
        }
    };
    
    fetchSeatStatus();
    window.handleResponse = function(data) {}; 

    // ------------------------------------------------------------------
    // 2. จัดการเมื่อจองสำเร็จ
    // ------------------------------------------------------------------
    window.handleSuccessfulSubmission = function(response) {
        if (response.status === 'success') {
            alert(`🎉 การจองสำเร็จแล้ว!`);
            alert(`รบกวนส่งหลักฐานการชำระเงินมาที่ไลน์ส่วนตัวของคุณครู เพื่อยืนยันการจองครับ`);
            
            if (selectedSeat) {
                selectedSeat.setAttribute('data-status', 'booked');
                selectedSeat.setAttribute('data-name', response.name);
            }
            closeModal();
            fetchSeatStatus(); // รีโหลดข้อมูลใหม่จาก Sheet เพื่อความแม่นยำ
        } else {
            alert('เกิดข้อผิดพลาด: ' + (response.message || 'กรุณาลองใหม่อีกครั้ง'));
            closeModal();
        }
    };

    // ------------------------------------------------------------------
    // 3. Logic การเปิด-ปิด Modal
    // ------------------------------------------------------------------
    const closeModal = () => {
        modal.style.display = 'none';
        bookingForm.reset(); 
        selectedSeat = null;
        bookingFormArea.style.display = 'none';
        transferDetails.style.display = 'block';
    };

    seats.forEach(seat => {
        seat.addEventListener('click', (e) => {
            e.stopPropagation(); 
            
            const status = seat.getAttribute('data-status') ? seat.getAttribute('data-status').toLowerCase() : 'available';
            
            if (status === 'booked') {
                const bookedBy = seat.getAttribute('data-name') || 'ผู้อื่น';
                alert(`❌ ที่นั่ง ${seat.getAttribute('data-seat-id')} ถูกจองแล้วโดย ${bookedBy}`);
                return; 
            }
            
            selectedSeat = seat;
            const seatId = selectedSeat.getAttribute('data-seat-id'); 
            // ปรับโค้ดให้หาชื่อโต๊ะจากโครงสร้างใหม่ (.desk-item หรือ .desk)
            const deskContainer = selectedSeat.closest('.desk-item') || selectedSeat.closest('.desk');
            const deskLabel = deskContainer ? deskContainer.querySelector('.table-top, .desk-label').textContent : 'ไม่ระบุ';

            const deskInfo = `${deskLabel} (ที่นั่ง ${seatId})`;
            currentDeskInfoStep1.textContent = deskInfo;
            currentDeskInfoStep2.textContent = deskInfo;
            
            modal.style.display = 'block';
        });
    });

    nextToFormButton.addEventListener('click', () => {
        transferDetails.style.display = 'none';
        bookingFormArea.style.display = 'block';
    });
    
    backToDetailsButton.addEventListener('click', () => {
        bookingFormArea.style.display = 'none';
        transferDetails.style.display = 'block';
    });

    closeButton.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });

    // ------------------------------------------------------------------
    // 4. การส่งข้อมูลไปยัง Google Sheet
    // ------------------------------------------------------------------
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        if (!selectedSeat) return;

        const seatId = selectedSeat.getAttribute('data-seat-id');
        const deskContainer = selectedSeat.closest('.desk-item') || selectedSeat.closest('.desk');
        const deskLabel = deskContainer ? deskContainer.querySelector('.table-top, .desk-label').textContent : 'N/A';
        
        const formData = new FormData(bookingForm);
        formData.append('deskId', deskLabel); // ส่งชื่อโต๊ะไป เช่น "โต๊ะ 1"
        formData.append('seatId', seatId);   // ส่งรหัสที่นั่งไป เช่น "A1"
        
        // แสดง Loading (ถ้ามีปุ่ม)
        const submitBtn = bookingForm.querySelector('button[type="submit"]');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'กำลังบันทึกข้อมูล...';

        try {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                body: formData, 
            });

            const result = await response.json();
            window.handleSuccessfulSubmission(result); 

        } catch (error) {
            console.error("Error:", error);
            alert("การส่งข้อมูลขัดข้อง กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต");
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });
});
