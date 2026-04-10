// Aapke kisi bhi component mein, jaise JobCardPage.jsx
import { useToast } from "@/components/ui/use-toast"

export default function JobCardPage() {
  const { toast } = useToast()

  const handleSaveJobCard = () => {
    // Job card save karne ka logic yahan aayega

    // Toast dikhao
    toast({
      title: "Success",
      description: "Job card created successfully",
      duration: 3000, // 3 seconds
    })
  }

  const handleError = () => {
    toast({
      title: "Error",
      description: "Something went wrong",
      variant: "destructive", // red color ke liye
      duration: 3000,
    })
  }

  return (
    <div>
      <button 
        onClick={handleSaveJobCard}
        className="bg-green-500 text-white px-4 py-2 rounded"
      >
        Save Job Card
      </button>
      
      <button 
        onClick={handleError}
        className="bg-red-500 text-white px-4 py-2 rounded ml-2"
      >
        Show Error
      </button>
    </div>
  )
}