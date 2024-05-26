import { useState } from "react";
import AddRoomForm from "../../../components/Form/AddRoomForm";
import useAuth from "../../../hooks/useAuth";
import { imageUpload } from "../../../Api/Utility";
import { Helmet } from "react-helmet-async";
import { useMutation } from "@tanstack/react-query"
import useAxiosSecure from "../../../hooks/useAxiosSecure";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const AddRoom = () => {
    const [imagePreview, setImagePreview] = useState();
    const [imageText, setimageText] = useState('');

    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const axiosSecure = useAxiosSecure();

    const { user } = useAuth()
    const [dates, setDates] = useState(
        {
            startDate: new Date(),
            endDate: new Date(),
            key: 'selection'
        }
    )

    // handle dates 
    const handleDates = item => {
        console.log(item)
        setDates(item.selection)
    }

    const { mutateAsync } = useMutation({
        mutationFn: async (roomData) => {
            const { data } = await axiosSecure.post('/room', roomData)
            return data
        },
        onSuccess: () => {
            console.log('room added Succesful')
            toast.success('Room added Succecfull')
            navigate('/dashboard/my-listings')
            setLoading(false)
        }
    })
    // handle submit 
    const handleSubmit = async e => {
        e.preventDefault();

        const form = e.target;
        const location = form.location.value;
        const category = form.category.value;
        const title = form.title.value;
        const to = dates.endDate;
        const from = dates.startDate;
        const price = form.price.value;
        const quests = form.total_guest.value;
        const bathrooms = form.bathrooms.value;
        const bedrooms = form.bedrooms.value;
        const description = form.description.value;
        const image = form.image.files[0];
        const host = {
            name: user?.displayName,
            image: user?.photoURL,
            email: user?.email
        }

        try {
            setLoading(true)
            const image_url = await imageUpload(image);

            const roomData = {
                location,
                category,
                title,
                to,
                from,
                price,
                quests,
                bedrooms,
                bathrooms,
                description,
                host,
                image: image_url,
            }

            console.table(roomData)

            // post request 
            mutateAsync(roomData)
        } catch (err) {
            console.log(err)

            toast.error(err.message)
            setLoading(false)
        }
    }

    const handleImage = image => {
        setImagePreview(URL.createObjectURL(image))
        setimageText(image.name)
    }

    return (
        <>
            <Helmet>
                <title>Add room | Dashboard</title>
            </Helmet>
            <AddRoomForm dates={dates}
                handleDates={handleDates}
                handleSubmit={handleSubmit}
                setImagePreview={setImagePreview}
                handleImage={handleImage}
                imagePreview={imagePreview}
                imageText={imageText}
                loading={loading}
            />
        </>
    );
};

export default AddRoom;